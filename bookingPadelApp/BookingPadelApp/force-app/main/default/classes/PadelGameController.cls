/**
 * @description Controller for Padel Booking public site operations.
 *              Uses 'without sharing' to enable Guest User access to custom objects.
 * @author Padel Booking Team
 * @date 2025-10-22
 * @security IMPORTANT: This class intentionally bypasses sharing rules to allow
 *           unauthenticated Guest Users to perform CRUD operations. This is acceptable
 *           for a public booking application where all data is intended to be public.
 */
public without sharing class PadelGameController {

    /**
     * @description Retrieves all available games (not cancelled or full) with their players
     * @return List of Padel_Game__c records with related players
     */
    @AuraEnabled
    public static List<Padel_Game__c> getAvailableGames() {
        try {
            return [
                SELECT Id, Name, Game_Date__c, Game_Time__c, Court_Name__c,
                       Total_Price__c, Price_Per_Person__c, Max_Players__c,
                       Current_Players__c, Status__c, Share_Link__c, Day_Of_Week__c,
                       Creator_Email__c, Notes__c,
                       (SELECT Id, Player_Name__c, Email__c, Phone__c,
                               Payment_Status__c, Registration_Date__c
                        FROM Padel_Players__r
                        ORDER BY Registration_Date__c ASC)
                FROM Padel_Game__c
                WHERE Status__c != 'Anulowana'
                  AND Game_Date__c >= TODAY
                ORDER BY Game_Date__c ASC, Game_Time__c ASC
                LIMIT 100
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas pobierania gier: ' + e.getMessage());
        }
    }

    /**
     * @description Creates a new padel game
     * @param gameData JSON string containing game details
     * @return Id of newly created game
     */
    @AuraEnabled
    public static Id createGame(String gameData) {
        try {
            // Parse incoming JSON data
            Map<String, Object> gameMap = (Map<String, Object>) JSON.deserializeUntyped(gameData);

            // Validate required fields
            if (!gameMap.containsKey('Game_Date__c') || gameMap.get('Game_Date__c') == null) {
                throw new AuraHandledException('Data gry jest wymagana');
            }
            if (!gameMap.containsKey('Game_Time__c') || gameMap.get('Game_Time__c') == null) {
                throw new AuraHandledException('Godzina gry jest wymagana');
            }
            if (!gameMap.containsKey('Court_Name__c') || gameMap.get('Court_Name__c') == null) {
                throw new AuraHandledException('Kort jest wymagany');
            }
            if (!gameMap.containsKey('Total_Price__c') || gameMap.get('Total_Price__c') == null) {
                throw new AuraHandledException('Cena jest wymagana');
            }

            // Create game record
            Padel_Game__c newGame = new Padel_Game__c();
            newGame.Game_Date__c = Date.valueOf((String) gameMap.get('Game_Date__c'));
            newGame.Game_Time__c = Time.newInstance(
                Integer.valueOf(((String) gameMap.get('Game_Time__c')).split(':')[0]),
                Integer.valueOf(((String) gameMap.get('Game_Time__c')).split(':')[1]),
                0, 0
            );
            newGame.Court_Name__c = (String) gameMap.get('Court_Name__c');
            newGame.Total_Price__c = Decimal.valueOf(String.valueOf(gameMap.get('Total_Price__c')));
            newGame.Max_Players__c = gameMap.containsKey('Max_Players__c')
                ? Decimal.valueOf(String.valueOf(gameMap.get('Max_Players__c')))
                : 4;
            newGame.Status__c = 'Dostępna';

            // Optional fields
            if (gameMap.containsKey('Creator_Email__c') && gameMap.get('Creator_Email__c') != null) {
                newGame.Creator_Email__c = (String) gameMap.get('Creator_Email__c');
            }
            if (gameMap.containsKey('Notes__c') && gameMap.get('Notes__c') != null) {
                newGame.Notes__c = (String) gameMap.get('Notes__c');
            }

            insert newGame;
            return newGame.Id;

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas tworzenia gry: ' + e.getMessage());
        }
    }

    /**
     * @description Adds a player to an existing game
     * @param gameId Id of the game to join
     * @param playerData JSON string containing player details
     * @return Id of newly created player record
     */
    @AuraEnabled
    public static Id addPlayerToGame(String gameId, String playerData) {
        try {
            // Validate game exists and has capacity
            Padel_Game__c game = [
                SELECT Id, Max_Players__c, Current_Players__c, Status__c
                FROM Padel_Game__c
                WHERE Id = :gameId
                LIMIT 1
            ];

            // Check if game is full
            if (game.Current_Players__c >= game.Max_Players__c) {
                throw new AuraHandledException('Ta gra jest już pełna');
            }

            // Check if game is cancelled
            if (game.Status__c == 'Anulowana') {
                throw new AuraHandledException('Ta gra została anulowana');
            }

            // Parse player data
            Map<String, Object> playerMap = (Map<String, Object>) JSON.deserializeUntyped(playerData);

            // Validate required fields
            if (!playerMap.containsKey('Player_Name__c') || String.isBlank((String) playerMap.get('Player_Name__c'))) {
                throw new AuraHandledException('Imię gracza jest wymagane');
            }
            if (!playerMap.containsKey('Email__c') || String.isBlank((String) playerMap.get('Email__c'))) {
                throw new AuraHandledException('Email jest wymagany');
            }

            String playerEmail = (String) playerMap.get('Email__c');

            // Check for duplicate email in this game
            List<Padel_Player__c> existingPlayers = [
                SELECT Id
                FROM Padel_Player__c
                WHERE Game__c = :gameId
                  AND Email__c = :playerEmail
                LIMIT 1
            ];

            if (!existingPlayers.isEmpty()) {
                throw new AuraHandledException('Ten email jest już zarejestrowany w tej grze');
            }

            // Create player record
            Padel_Player__c newPlayer = new Padel_Player__c();
            newPlayer.Game__c = gameId;
            newPlayer.Player_Name__c = (String) playerMap.get('Player_Name__c');
            newPlayer.Email__c = playerEmail;
            newPlayer.Payment_Status__c = 'Niezapłacone';
            newPlayer.Registration_Date__c = System.now();

            // Optional phone field
            if (playerMap.containsKey('Phone__c') && !String.isBlank((String) playerMap.get('Phone__c'))) {
                newPlayer.Phone__c = (String) playerMap.get('Phone__c');
            }

            insert newPlayer;

            // Update game status if needed
            updateGameStatus(gameId);

            return newPlayer.Id;

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas dodawania gracza: ' + e.getMessage());
        }
    }

    /**
     * @description Updates payment status for a player
     * @param playerId Id of the player record
     * @param status New payment status (Zapłacone/Niezapłacone)
     */
    @AuraEnabled
    public static void updatePlayerPaymentStatus(String playerId, String status) {
        try {
            // Validate status value
            if (status != 'Zapłacone' && status != 'Niezapłacone') {
                throw new AuraHandledException('Nieprawidłowy status płatności');
            }

            Padel_Player__c player = [
                SELECT Id, Payment_Status__c
                FROM Padel_Player__c
                WHERE Id = :playerId
                LIMIT 1
            ];

            player.Payment_Status__c = status;
            update player;

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas aktualizacji statusu płatności: ' + e.getMessage());
        }
    }

    /**
     * @description Removes a player from a game
     * @param playerId Id of the player to remove
     */
    @AuraEnabled
    public static void removePlayerFromGame(String playerId) {
        try {
            Padel_Player__c player = [
                SELECT Id, Game__c
                FROM Padel_Player__c
                WHERE Id = :playerId
                LIMIT 1
            ];

            String gameId = player.Game__c;
            delete player;

            // Update game status after player removal
            updateGameStatus(gameId);

        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas usuwania gracza: ' + e.getMessage());
        }
    }

    /**
     * @description Deletes a game and all associated players
     * @param gameId Id of the game to delete
     */
    @AuraEnabled
    public static void deleteGame(String gameId) {
        try {
            Padel_Game__c game = [
                SELECT Id
                FROM Padel_Game__c
                WHERE Id = :gameId
                LIMIT 1
            ];

            // Master-detail relationship will cascade delete all players
            delete game;

        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas usuwania gry: ' + e.getMessage());
        }
    }

    /**
     * @description Updates game status based on current player count
     * @param gameId Id of the game to update
     */
    private static void updateGameStatus(String gameId) {
        try {
            Padel_Game__c game = [
                SELECT Id, Max_Players__c, Current_Players__c, Status__c
                FROM Padel_Game__c
                WHERE Id = :gameId
                LIMIT 1
            ];

            String newStatus;

            if (game.Current_Players__c >= game.Max_Players__c) {
                newStatus = 'Pełna';
            } else if (game.Current_Players__c >= (game.Max_Players__c - 1)) {
                newStatus = 'Zarezerwowana';
            } else {
                newStatus = 'Dostępna';
            }

            // Only update if status changed
            if (game.Status__c != newStatus && game.Status__c != 'Anulowana') {
                game.Status__c = newStatus;
                update game;
            }

        } catch (Exception e) {
            // Log error but don't throw - status update is non-critical
            System.debug('Error updating game status: ' + e.getMessage());
        }
    }

    /**
     * @description Retrieves a specific game by ID
     * @param gameId Id of the game
     * @return Padel_Game__c record with players
     */
    @AuraEnabled
    public static Padel_Game__c getGameById(String gameId) {
        try {
            return [
                SELECT Id, Name, Game_Date__c, Game_Time__c, Court_Name__c,
                       Total_Price__c, Price_Per_Person__c, Max_Players__c,
                       Current_Players__c, Status__c, Share_Link__c, Day_Of_Week__c,
                       Creator_Email__c, Notes__c,
                       (SELECT Id, Player_Name__c, Email__c, Phone__c,
                               Payment_Status__c, Registration_Date__c
                        FROM Padel_Players__r
                        ORDER BY Registration_Date__c ASC)
                FROM Padel_Game__c
                WHERE Id = :gameId
                LIMIT 1
            ];
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas pobierania gry: ' + e.getMessage());
        }
    }
}
