/**
 * @description Controller for Padel Booking public site operations.
 *              Uses 'without sharing' to enable Guest User access to custom objects.
 * @author Padel Booking Team
 * @date 2025-10-27
 * @security IMPORTANT: This class intentionally bypasses sharing rules to allow
 *           unauthenticated Guest Users to perform CRUD operations. This is acceptable
 *           for a public booking application where all data is intended to be public.
 */
public without sharing class PadelGameController {

    // ========================================================================
    // WRAPPER CLASSES
    // ========================================================================

    /**
     * @description Wrapper class for game data with court and player information
     */
    public class GameWrapper {
        @AuraEnabled public Id gameId;
        @AuraEnabled public String gameName;
        @AuraEnabled public Date gameDate;
        @AuraEnabled public Time gameTime;
        @AuraEnabled public String dayOfWeek;
        @AuraEnabled public String courtName;
        @AuraEnabled public String courtLocation;
        @AuraEnabled public Decimal totalPrice;
        @AuraEnabled public Decimal pricePerPerson;
        @AuraEnabled public Integer maxPlayers;
        @AuraEnabled public Integer currentPlayers;
        @AuraEnabled public String status;
        @AuraEnabled public String shareLink;
        @AuraEnabled public String notes;
        @AuraEnabled public String organizerName;
        @AuraEnabled public Id organizerId;
        @AuraEnabled public List<PlayerWrapper> players;
        @AuraEnabled public Decimal duration;
    }

    /**
     * @description Wrapper class for player registration data
     */
    public class PlayerWrapper {
        @AuraEnabled public Id registrationId;
        @AuraEnabled public Id playerId;
        @AuraEnabled public String playerName;
        @AuraEnabled public String paymentStatus;
        @AuraEnabled public DateTime registrationDate;
        @AuraEnabled public Boolean isOrganizer;
    }

    /**
     * @description Wrapper class for player options in picklists/searches
     */
    public class PlayerOption {
        @AuraEnabled public Id playerId;
        @AuraEnabled public String playerName;
        @AuraEnabled public Integer gameCount;
    }

    /**
     * @description Wrapper class for court options in picklists/searches
     */
    public class CourtOption {
        @AuraEnabled public Id courtId;
        @AuraEnabled public String courtName;
        @AuraEnabled public Integer courtNumber;
        @AuraEnabled public String location;
    }

    // ========================================================================
    // GAME OPERATIONS
    // ========================================================================

    /**
     * @description Retrieves all available games (not cancelled or full) with their players
     * @return List of GameWrapper records with related players
     */
    @AuraEnabled
    public static List<GameWrapper> getAvailableGames() {
        try {
            List<Padel_Game__c> games = [
                SELECT Id, Name, Game_Date__c, Game_Time__c, Day_Of_Week__c,
                       Total_Price__c, Price_Per_Person__c, Max_Players__c,
                       Current_Players__c, Status__c, Share_Link__c, Notes__c, Duration__c,
                       Court__r.Court_Name__c, Court__r.Location__c,
                       Organizer__r.Player_Name__c, Organizer__c,
                       (SELECT Id, Player__c, Player__r.Player_Name__c,
                               Payment_Status__c, Registration_Date__c, Is_Organizer__c
                        FROM Game_Registrations__r
                        ORDER BY Registration_Date__c ASC)
                FROM Padel_Game__c
                WHERE Status__c != 'Anulowana'
                  AND Game_Date__c >= TODAY
                ORDER BY Game_Date__c ASC, Game_Time__c ASC
                LIMIT 100
            ];

            return buildGameWrappers(games);

        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas pobierania gier: ' + e.getMessage());
        }
    }

    /**
     * @description Creates a new padel game with organizer
     * @param courtId Id of the court
     * @param organizerPlayerId Id of the organizer player
     * @param gameDate Date of the game
     * @param gameTime Time of the game (HH:mm format)
     * @param totalPrice Total price for the game
     * @param duration Duration of the game in hours (e.g., 1.5)
     * @param maxPlayers Maximum number of players (default 4)
     * @param notes Optional notes
     * @return Id of newly created game
     */
    @AuraEnabled
    public static Id createGame(Id courtId, Id organizerPlayerId, String gameDate,
                                String gameTime, Decimal totalPrice, Decimal duration,
                                Integer maxPlayers, String notes) {
        try {
            // Validate required fields
            if (courtId == null) {
                throw new AuraHandledException('Kort jest wymagany');
            }
            if (organizerPlayerId == null) {
                throw new AuraHandledException('Organizator jest wymagany');
            }
            if (String.isBlank(gameDate)) {
                throw new AuraHandledException('Data gry jest wymagana');
            }
            if (String.isBlank(gameTime)) {
                throw new AuraHandledException('Godzina gry jest wymagana');
            }
            if (totalPrice == null || totalPrice <= 0) {
                throw new AuraHandledException('Cena musi być większa od zera');
            }
            if (duration == null || duration <= 0) {
                throw new AuraHandledException('Czas trwania jest wymagany i musi być większy od zera');
            }

            // Verify court exists
            List<Padel_Court__c> courts = [SELECT Id FROM Padel_Court__c WHERE Id = :courtId LIMIT 1];
            if (courts.isEmpty()) {
                throw new AuraHandledException('Nie znaleziono kortu');
            }

            // Verify organizer exists
            List<Padel_Player__c> players = [SELECT Id FROM Padel_Player__c WHERE Id = :organizerPlayerId LIMIT 1];
            if (players.isEmpty()) {
                throw new AuraHandledException('Nie znaleziono organizatora');
            }

            // Parse time
            List<String> timeParts = gameTime.split(':');
            Time parsedTime = Time.newInstance(
                Integer.valueOf(timeParts[0]),
                Integer.valueOf(timeParts[1]),
                0, 0
            );

            // Create game record
            Padel_Game__c newGame = new Padel_Game__c();
            newGame.Game_Date__c = Date.valueOf(gameDate);
            newGame.Game_Time__c = parsedTime;
            newGame.Court__c = courtId;
            newGame.Organizer__c = organizerPlayerId;
            newGame.Total_Price__c = totalPrice;
            newGame.Duration__c = duration;
            newGame.Max_Players__c = maxPlayers != null ? maxPlayers : 4;
            newGame.Status__c = 'Dostępna';
            newGame.Notes__c = notes;

            insert newGame;

            // Create registration for organizer
            Padel_Game_Registration__c organizerReg = new Padel_Game_Registration__c();
            organizerReg.Game__c = newGame.Id;
            organizerReg.Player__c = organizerPlayerId;
            organizerReg.Is_Organizer__c = true;
            organizerReg.Payment_Status__c = 'Niezapłacone';
            organizerReg.Registration_Date__c = System.now();

            insert organizerReg;

            return newGame.Id;

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas tworzenia gry: ' + e.getMessage());
        }
    }

    /**
     * @description Updates an existing padel game with new values
     * @param gameId Id of the game to update (required)
     * @param courtId New court ID (optional)
     * @param gameDate New date of the game in YYYY-MM-DD format (optional)
     * @param gameTime New time of the game in HH:mm format (optional)
     * @param totalPrice New total price (optional)
     * @param duration New duration in hours as Decimal (optional, e.g., 1.5)
     * @param notes New notes text (optional)
     * @param maxPlayers New max players count (optional)
     * @return Updated GameWrapper object
     * @throws AuraHandledException if gameId is null, game not found, or validation fails
     */
    @AuraEnabled
    public static GameWrapper updateGame(Id gameId, Id courtId, String gameDate,
                                          String gameTime, Decimal totalPrice, Decimal duration,
                                          String notes, Integer maxPlayers) {
        try {
            // Validate gameId
            if (gameId == null) {
                throw new AuraHandledException('ID gry jest wymagane');
            }

            // Retrieve current game
            List<Padel_Game__c> games = [
                SELECT Id, Name, Game_Date__c, Game_Time__c, Day_Of_Week__c,
                       Total_Price__c, Price_Per_Person__c, Max_Players__c,
                       Current_Players__c, Status__c, Share_Link__c, Notes__c, Duration__c,
                       Court__c, Organizer__c,
                       Court__r.Court_Name__c, Court__r.Location__c,
                       Organizer__r.Player_Name__c,
                       (SELECT Id, Player__c, Player__r.Player_Name__c,
                               Payment_Status__c, Registration_Date__c, Is_Organizer__c
                        FROM Game_Registrations__r
                        ORDER BY Registration_Date__c ASC)
                FROM Padel_Game__c
                WHERE Id = :gameId
                LIMIT 1
            ];

            if (games.isEmpty()) {
                throw new AuraHandledException('Nie znaleziono gry o podanym ID');
            }

            Padel_Game__c game = games[0];

            // Validate court if provided
            if (courtId != null) {
                List<Padel_Court__c> courts = [SELECT Id FROM Padel_Court__c WHERE Id = :courtId LIMIT 1];
                if (courts.isEmpty()) {
                    throw new AuraHandledException('Nie znaleziono kortu');
                }
                game.Court__c = courtId;
            }

            // Update fields if provided
            if (String.isNotBlank(gameDate)) {
                game.Game_Date__c = Date.valueOf(gameDate);
            }

            if (String.isNotBlank(gameTime)) {
                List<String> timeParts = gameTime.split(':');
                Time parsedTime = Time.newInstance(
                    Integer.valueOf(timeParts[0]),
                    Integer.valueOf(timeParts[1]),
                    0, 0
                );
                game.Game_Time__c = parsedTime;
            }

            if (totalPrice != null) {
                if (totalPrice <= 0) {
                    throw new AuraHandledException('Cena musi być większa od zera');
                }
                game.Total_Price__c = totalPrice;
            }

            if (duration != null) {
                if (duration <= 0) {
                    throw new AuraHandledException('Czas trwania musi być większy od zera');
                }
                game.Duration__c = duration;
            }

            if (notes != null) {
                game.Notes__c = notes;
            }

            if (maxPlayers != null) {
                if (maxPlayers <= 0) {
                    throw new AuraHandledException('Maksymalna liczba graczy musi być większa od zera');
                }
                // Validate that new maxPlayers >= current players
                if (maxPlayers < game.Current_Players__c) {
                    throw new AuraHandledException('Maksymalna liczba graczy nie może być mniejsza od obecnej liczby graczy (' +
                                                   Integer.valueOf(game.Current_Players__c) + ')');
                }
                game.Max_Players__c = maxPlayers;
            }

            // Update game record
            update game;

            // Update game status based on new values
            updateGameStatus(game.Id);

            // Refresh and return game data
            return getGameById(game.Id);

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas aktualizacji gry: ' + e.getMessage());
        }
    }

    /**
     * @description Adds a player to an existing game
     * @param gameId Id of the game to join
     * @param playerId Id of the player joining
     * @return Id of newly created registration record
     */
    @AuraEnabled
    public static Id addPlayerToGame(Id gameId, Id playerId) {
        try {
            // Validate inputs
            if (gameId == null) {
                throw new AuraHandledException('ID gry jest wymagane');
            }
            if (playerId == null) {
                throw new AuraHandledException('ID gracza jest wymagane');
            }

            // Validate game exists and has capacity
            List<Padel_Game__c> games = [
                SELECT Id, Max_Players__c, Current_Players__c, Status__c
                FROM Padel_Game__c
                WHERE Id = :gameId
                LIMIT 1
            ];

            if (games.isEmpty()) {
                throw new AuraHandledException('Nie znaleziono gry');
            }

            Padel_Game__c game = games[0];

            // Check if game is full
            if (game.Current_Players__c >= game.Max_Players__c) {
                throw new AuraHandledException('Ta gra jest już pełna');
            }

            // Check if game is cancelled
            if (game.Status__c == 'Anulowana') {
                throw new AuraHandledException('Ta gra została anulowana');
            }

            // Verify player exists
            List<Padel_Player__c> players = [SELECT Id FROM Padel_Player__c WHERE Id = :playerId LIMIT 1];
            if (players.isEmpty()) {
                throw new AuraHandledException('Nie znaleziono gracza');
            }

            // Check if player is already registered
            List<Padel_Game_Registration__c> existingRegs = [
                SELECT Id
                FROM Padel_Game_Registration__c
                WHERE Game__c = :gameId AND Player__c = :playerId
                LIMIT 1
            ];

            if (!existingRegs.isEmpty()) {
                throw new AuraHandledException('Ten gracz jest już zapisany na tę grę');
            }

            // Create registration record
            Padel_Game_Registration__c newReg = new Padel_Game_Registration__c();
            newReg.Game__c = gameId;
            newReg.Player__c = playerId;
            newReg.Is_Organizer__c = false;
            newReg.Payment_Status__c = 'Niezapłacone';
            newReg.Registration_Date__c = System.now();

            insert newReg;

            // Update game status if needed
            updateGameStatus(gameId);

            return newReg.Id;

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas dodawania gracza: ' + e.getMessage());
        }
    }

    /**
     * @description Removes a player from a game with optional organizer transfer
     * @param registrationId Id of the registration to remove
     * @param autoTransferOrganizer If true, automatically transfers organizer role to next player
     */
    @AuraEnabled
    public static void removePlayerFromGame(Id registrationId, Boolean autoTransferOrganizer) {
        try {
            if (registrationId == null) {
                throw new AuraHandledException('ID rejestracji jest wymagane');
            }

            // Get registration details
            List<Padel_Game_Registration__c> registrations = [
                SELECT Id, Game__c, Player__c, Is_Organizer__c
                FROM Padel_Game_Registration__c
                WHERE Id = :registrationId
                LIMIT 1
            ];

            if (registrations.isEmpty()) {
                throw new AuraHandledException('Nie znaleziono rejestracji');
            }

            Padel_Game_Registration__c registration = registrations[0];
            Id gameId = registration.Game__c;
            Boolean wasOrganizer = registration.Is_Organizer__c;

            // Delete the registration
            delete registration;

            // If organizer was removed, handle transfer
            if (wasOrganizer && autoTransferOrganizer == true) {
                // Find next player to become organizer
                List<Padel_Game_Registration__c> remainingPlayers = [
                    SELECT Id, Player__c
                    FROM Padel_Game_Registration__c
                    WHERE Game__c = :gameId
                    ORDER BY Registration_Date__c ASC
                    LIMIT 1
                ];

                if (!remainingPlayers.isEmpty()) {
                    // Transfer organizer role to next player
                    changeOrganizer(gameId, remainingPlayers[0].Player__c);
                } else {
                    // No players left - optionally cancel or delete game
                    Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Id = :gameId LIMIT 1];
                    game.Status__c = 'Anulowana';
                    update game;
                }
            }

            // Update game status
            updateGameStatus(gameId);

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas usuwania gracza: ' + e.getMessage());
        }
    }

    /**
     * @description Updates payment status for a player's game registration using the registration ID.
     *              Validates that the status value is one of the allowed picklist values.
     * @param registrationId Id of the registration record (Padel_Game_Registration__c)
     * @param paymentStatus New payment status - must be either 'Zapłacone' or 'Niezapłacone'
     * @throws AuraHandledException if registrationId is null, invalid status, registration not found, or update fails
     * @example updatePaymentStatus(registrationId, 'Zapłacone');
     */
    @AuraEnabled
    public static void updatePaymentStatus(Id registrationId, String paymentStatus) {
        try {
            // Validate inputs
            if (registrationId == null) {
                throw new AuraHandledException('ID rejestracji jest wymagane');
            }

            if (String.isBlank(paymentStatus)) {
                throw new AuraHandledException('Status płatności jest wymagany');
            }

            // Validate payment status against allowed picklist values
            if (paymentStatus != 'Zapłacone' && paymentStatus != 'Niezapłacone') {
                throw new AuraHandledException(
                    'Nieprawidłowy status płatności. Dozwolone wartości: "Zapłacone" lub "Niezapłacone"'
                );
            }

            // Retrieve registration record
            List<Padel_Game_Registration__c> registrations = [
                SELECT Id, Payment_Status__c, Game__c, Player__r.Player_Name__c
                FROM Padel_Game_Registration__c
                WHERE Id = :registrationId
                LIMIT 1
            ];

            if (registrations.isEmpty()) {
                throw new AuraHandledException('Nie znaleziono rejestracji o podanym ID');
            }

            Padel_Game_Registration__c registration = registrations[0];

            // Check if status is already set to the requested value (optimization)
            if (registration.Payment_Status__c == paymentStatus) {
                // No update needed - status already matches
                return;
            }

            // Update payment status
            registration.Payment_Status__c = paymentStatus;
            Database.update(registration, true);

        } catch (AuraHandledException e) {
            throw e;
        } catch (QueryException e) {
            throw new AuraHandledException('Błąd podczas wyszukiwania rejestracji: ' + e.getMessage());
        } catch (DmlException e) {
            throw new AuraHandledException('Błąd podczas aktualizacji statusu płatności: ' + e.getMessage());
        } catch (Exception e) {
            throw new AuraHandledException('Nieoczekiwany błąd podczas aktualizacji statusu płatności: ' + e.getMessage());
        }
    }

    /**
     * @description Updates payment status for a player using player ID and game ID.
     *              This is an alternative to updatePaymentStatus() when you have playerId instead of registrationId.
     * @param gameId Id of the game
     * @param playerId Id of the player (Padel_Player__c)
     * @param paymentStatus New payment status - must be either 'Zapłacone' or 'Niezapłacone'
     * @throws AuraHandledException if parameters are invalid, player not registered, or update fails
     * @example updatePlayerPaymentStatus(gameId, playerId, 'Zapłacone');
     */
    @AuraEnabled
    public static void updatePlayerPaymentStatus(Id gameId, Id playerId, String paymentStatus) {
        try {
            // Validate inputs
            if (gameId == null) {
                throw new AuraHandledException('ID gry jest wymagane');
            }

            if (playerId == null) {
                throw new AuraHandledException('ID gracza jest wymagany');
            }

            if (String.isBlank(paymentStatus)) {
                throw new AuraHandledException('Status płatności jest wymagany');
            }

            // Validate payment status against allowed picklist values
            if (paymentStatus != 'Zapłacone' && paymentStatus != 'Niezapłacone') {
                throw new AuraHandledException(
                    'Nieprawidłowy status płatności. Dozwolone wartości: "Zapłacone" lub "Niezapłacone"'
                );
            }

            // Find the registration record for this player and game
            List<Padel_Game_Registration__c> registrations = [
                SELECT Id, Payment_Status__c, Player__r.Player_Name__c
                FROM Padel_Game_Registration__c
                WHERE Game__c = :gameId
                  AND Player__c = :playerId
                LIMIT 1
            ];

            if (registrations.isEmpty()) {
                throw new AuraHandledException('Nie znaleziono rejestracji dla tego gracza w tej grze');
            }

            Padel_Game_Registration__c registration = registrations[0];

            // Check if status is already set to the requested value (optimization)
            if (registration.Payment_Status__c == paymentStatus) {
                // No update needed - status already matches
                return;
            }

            // Update payment status
            registration.Payment_Status__c = paymentStatus;
            Database.update(registration, true);

        } catch (AuraHandledException e) {
            throw e;
        } catch (QueryException e) {
            throw new AuraHandledException('Błąd podczas wyszukiwania rejestracji gracza: ' + e.getMessage());
        } catch (DmlException e) {
            throw new AuraHandledException('Błąd podczas aktualizacji statusu płatności gracza: ' + e.getMessage());
        } catch (Exception e) {
            throw new AuraHandledException('Nieoczekiwany błąd podczas aktualizacji statusu płatności gracza: ' + e.getMessage());
        }
    }

    /**
     * @description Changes the organizer of a game
     * @param gameId Id of the game
     * @param newOrganizerPlayerId Id of the new organizer player
     */
    @AuraEnabled
    public static void changeOrganizer(Id gameId, Id newOrganizerPlayerId) {
        try {
            // Validate inputs
            if (gameId == null) {
                throw new AuraHandledException('ID gry jest wymagane');
            }
            if (newOrganizerPlayerId == null) {
                throw new AuraHandledException('ID nowego organizatora jest wymagane');
            }

            // Verify game exists
            List<Padel_Game__c> games = [
                SELECT Id, Organizer__c
                FROM Padel_Game__c
                WHERE Id = :gameId
                LIMIT 1
            ];

            if (games.isEmpty()) {
                throw new AuraHandledException('Nie znaleziono gry');
            }

            Padel_Game__c game = games[0];
            Id oldOrganizerId = game.Organizer__c;

            // Verify new organizer exists and is registered for the game
            List<Padel_Game_Registration__c> newOrganizerRegs = [
                SELECT Id, Is_Organizer__c
                FROM Padel_Game_Registration__c
                WHERE Game__c = :gameId AND Player__c = :newOrganizerPlayerId
                LIMIT 1
            ];

            if (newOrganizerRegs.isEmpty()) {
                throw new AuraHandledException('Nowy organizator musi być zapisany na grę');
            }

            // Update game organizer
            game.Organizer__c = newOrganizerPlayerId;
            update game;

            // Update registration records - remove old organizer flag
            if (oldOrganizerId != null) {
                List<Padel_Game_Registration__c> oldOrganizerRegs = [
                    SELECT Id, Is_Organizer__c
                    FROM Padel_Game_Registration__c
                    WHERE Game__c = :gameId AND Player__c = :oldOrganizerId
                    LIMIT 1
                ];

                if (!oldOrganizerRegs.isEmpty()) {
                    oldOrganizerRegs[0].Is_Organizer__c = false;
                    update oldOrganizerRegs[0];
                }
            }

            // Set new organizer flag
            newOrganizerRegs[0].Is_Organizer__c = true;
            update newOrganizerRegs[0];

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas zmiany organizatora: ' + e.getMessage());
        }
    }

    /**
     * @description Retrieves registrations for a specific game
     * @param gameId Id of the game
     * @return List of PlayerWrapper records
     */
    @AuraEnabled
    public static List<PlayerWrapper> getGameRegistrations(Id gameId) {
        try {
            if (gameId == null) {
                throw new AuraHandledException('ID gry jest wymagane');
            }

            List<Padel_Game_Registration__c> registrations = [
                SELECT Id, Player__c, Player__r.Player_Name__c,
                       Payment_Status__c, Registration_Date__c, Is_Organizer__c
                FROM Padel_Game_Registration__c
                WHERE Game__c = :gameId
                ORDER BY Registration_Date__c ASC
            ];

            List<PlayerWrapper> players = new List<PlayerWrapper>();
            for (Padel_Game_Registration__c reg : registrations) {
                PlayerWrapper pw = new PlayerWrapper();
                pw.registrationId = reg.Id;
                pw.playerId = reg.Player__c;
                pw.playerName = reg.Player__r.Player_Name__c;
                pw.paymentStatus = reg.Payment_Status__c;
                pw.registrationDate = reg.Registration_Date__c;
                pw.isOrganizer = reg.Is_Organizer__c;
                players.add(pw);
            }

            return players;

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas pobierania rejestracji: ' + e.getMessage());
        }
    }

    /**
     * @description Deletes a game and all associated registrations.
     *              Since Game__c is a Lookup field (not Master-Detail) with Restrict constraint,
     *              we must manually delete registrations before deleting the game.
     * @param gameId Id of the game to delete
     * @throws AuraHandledException if gameId is null, game not found, or deletion fails
     */
    @AuraEnabled
    public static void deleteGame(Id gameId) {
        try {
            // Validate input
            if (gameId == null) {
                throw new AuraHandledException('ID gry jest wymagane');
            }

            // Verify game exists before attempting deletion
            List<Padel_Game__c> games = [
                SELECT Id, Status__c
                FROM Padel_Game__c
                WHERE Id = :gameId
                LIMIT 1
            ];

            if (games.isEmpty()) {
                throw new AuraHandledException('Nie znaleziono gry o podanym ID');
            }

            // Delete all registrations first (Lookup relationship requires manual deletion)
            // Note: Using Database.delete with allOrNone=true for atomic operation
            List<Padel_Game_Registration__c> registrations = [
                SELECT Id
                FROM Padel_Game_Registration__c
                WHERE Game__c = :gameId
            ];

            if (!registrations.isEmpty()) {
                Database.delete(registrations, true);
            }

            // Delete the game record
            Database.delete(games[0], true);

        } catch (AuraHandledException e) {
            throw e;
        } catch (QueryException e) {
            throw new AuraHandledException('Błąd podczas wyszukiwania gry: ' + e.getMessage());
        } catch (DmlException e) {
            throw new AuraHandledException('Błąd podczas usuwania gry lub rejestracji: ' + e.getMessage());
        } catch (Exception e) {
            throw new AuraHandledException('Nieoczekiwany błąd podczas usuwania gry: ' + e.getMessage());
        }
    }

    // ========================================================================
    // PLAYER OPERATIONS
    // ========================================================================

    /**
     * @description Searches for players by name, optionally filtering out those already registered for a game
     * @param searchTerm Search string (optional, returns all if blank)
     * @param gameId Optional game ID to exclude already registered players
     * @return List of PlayerOption records with game counts
     */
    @AuraEnabled
    public static List<PlayerOption> getPlayers(String searchTerm, Id gameId) {
        try {
            String searchPattern = '%' + (String.isBlank(searchTerm) ? '' : searchTerm) + '%';

            // Debug logging
            System.debug('getPlayers called with searchTerm: ' + searchTerm + ', gameId: ' + gameId);

            // Get IDs of players already registered for this game
            Set<Id> registeredPlayerIds = new Set<Id>();
            if (gameId != null) {
                List<Padel_Game_Registration__c> registrations = [
                    SELECT Player__c
                    FROM Padel_Game_Registration__c
                    WHERE Game__c = :gameId
                ];

                System.debug('Found ' + registrations.size() + ' registrations for game ' + gameId);

                for (Padel_Game_Registration__c reg : registrations) {
                    registeredPlayerIds.add(reg.Player__c);
                    System.debug('Excluding player: ' + reg.Player__c);
                }
            }

            List<Padel_Player__c> players = [
                SELECT Id, Player_Name__c,
                       (SELECT Id FROM Player_Registrations__r)
                FROM Padel_Player__c
                WHERE Player_Name__c LIKE :searchPattern
                  AND Id NOT IN :registeredPlayerIds
                ORDER BY Player_Name__c ASC
                LIMIT 50
            ];

            System.debug('Returning ' + players.size() + ' available players');

            List<PlayerOption> options = new List<PlayerOption>();
            for (Padel_Player__c player : players) {
                PlayerOption po = new PlayerOption();
                po.playerId = player.Id;
                po.playerName = player.Player_Name__c;
                po.gameCount = player.Player_Registrations__r.size();
                options.add(po);
            }

            return options;

        } catch (Exception e) {
            System.debug('Error in getPlayers: ' + e.getMessage());
            throw new AuraHandledException('Błąd podczas wyszukiwania graczy: ' + e.getMessage());
        }
    }

    /**
     * @description Creates a new player record
     * @param playerName Name of the player
     * @return Id of newly created player
     */
    @AuraEnabled
    public static Id createPlayer(String playerName) {
        try {
            if (String.isBlank(playerName)) {
                throw new AuraHandledException('Nazwa gracza jest wymagana');
            }

            // Check for duplicate name
            List<Padel_Player__c> existingPlayers = [
                SELECT Id FROM Padel_Player__c WHERE Player_Name__c = :playerName LIMIT 1
            ];

            if (!existingPlayers.isEmpty()) {
                throw new AuraHandledException('Gracz o tej nazwie już istnieje');
            }

            Padel_Player__c newPlayer = new Padel_Player__c();
            newPlayer.Player_Name__c = playerName;
            insert newPlayer;

            return newPlayer.Id;

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas tworzenia gracza: ' + e.getMessage());
        }
    }

    // ========================================================================
    // COURT OPERATIONS
    // ========================================================================

    /**
     * @description Searches for courts by name
     * @param searchTerm Search string (optional, returns all if blank)
     * @return List of CourtOption records
     */
    @AuraEnabled
    public static List<CourtOption> getCourts(String searchTerm) {
        try {
            String searchPattern = '%' + (String.isBlank(searchTerm) ? '' : searchTerm) + '%';

            List<Padel_Court__c> courts = [
                SELECT Id, Court_Name__c, Court_Number__c, Location__c
                FROM Padel_Court__c
                WHERE Court_Name__c LIKE :searchPattern
                ORDER BY Court_Name__c ASC
                LIMIT 50
            ];

            List<CourtOption> options = new List<CourtOption>();
            for (Padel_Court__c court : courts) {
                CourtOption co = new CourtOption();
                co.courtId = court.Id;
                co.courtName = court.Court_Name__c;
                co.courtNumber = court.Court_Number__c != null ? Integer.valueOf(court.Court_Number__c) : null;
                co.location = court.Location__c;
                options.add(co);
            }

            return options;

        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas wyszukiwania kortów: ' + e.getMessage());
        }
    }

    /**
     * @description Creates a new court record
     * @param courtName Name of the court
     * @param courtNumber Optional court number
     * @param location Optional location
     * @return Id of newly created court
     */
    @AuraEnabled
    public static Id createCourt(String courtName, Integer courtNumber, String location) {
        try {
            if (String.isBlank(courtName)) {
                throw new AuraHandledException('Nazwa kortu jest wymagana');
            }

            // Check for duplicate name
            List<Padel_Court__c> existingCourts = [
                SELECT Id FROM Padel_Court__c WHERE Court_Name__c = :courtName LIMIT 1
            ];

            if (!existingCourts.isEmpty()) {
                throw new AuraHandledException('Kort o tej nazwie już istnieje');
            }

            Padel_Court__c newCourt = new Padel_Court__c();
            newCourt.Court_Name__c = courtName;
            newCourt.Court_Number__c = courtNumber;
            newCourt.Location__c = location;
            insert newCourt;

            return newCourt.Id;

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas tworzenia kortu: ' + e.getMessage());
        }
    }

    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================

    /**
     * @description Updates game status based on current player count
     * @param gameId Id of the game to update
     */
    private static void updateGameStatus(Id gameId) {
        try {
            Padel_Game__c game = [
                SELECT Id, Max_Players__c, Current_Players__c, Status__c
                FROM Padel_Game__c
                WHERE Id = :gameId
                LIMIT 1
            ];

            String newStatus;

            if (game.Current_Players__c == 0) {
                newStatus = 'Dostępna';
            } else if (game.Current_Players__c >= game.Max_Players__c) {
                newStatus = 'Pełna';
            } else if (game.Current_Players__c >= (game.Max_Players__c - 1)) {
                newStatus = 'Zarezerwowana';
            } else {
                newStatus = 'Dostępna';
            }

            // Only update if status changed and not cancelled
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
     * @description Converts Padel_Game__c records to GameWrapper objects
     * @param games List of games to convert
     * @return List of GameWrapper objects
     */
    private static List<GameWrapper> buildGameWrappers(List<Padel_Game__c> games) {
        List<GameWrapper> wrappers = new List<GameWrapper>();

        for (Padel_Game__c game : games) {
            GameWrapper gw = new GameWrapper();
            gw.gameId = game.Id;
            gw.gameName = game.Name;
            gw.gameDate = game.Game_Date__c;
            gw.gameTime = game.Game_Time__c;
            gw.dayOfWeek = game.Day_Of_Week__c;
            gw.courtName = game.Court__r.Court_Name__c;
            gw.courtLocation = game.Court__r.Location__c;
            gw.totalPrice = game.Total_Price__c;
            gw.pricePerPerson = game.Price_Per_Person__c;
            gw.maxPlayers = Integer.valueOf(game.Max_Players__c);
            gw.currentPlayers = Integer.valueOf(game.Current_Players__c);
            gw.status = game.Status__c;
            gw.shareLink = game.Share_Link__c;
            gw.notes = game.Notes__c;
            gw.organizerName = game.Organizer__r.Player_Name__c;
            gw.organizerId = game.Organizer__c;
            gw.duration = game.Duration__c;

            // Build player list
            gw.players = new List<PlayerWrapper>();
            for (Padel_Game_Registration__c reg : game.Game_Registrations__r) {
                PlayerWrapper pw = new PlayerWrapper();
                pw.registrationId = reg.Id;
                pw.playerId = reg.Player__c;
                pw.playerName = reg.Player__r.Player_Name__c;
                pw.paymentStatus = reg.Payment_Status__c;
                pw.registrationDate = reg.Registration_Date__c;
                pw.isOrganizer = reg.Is_Organizer__c;
                gw.players.add(pw);
            }

            wrappers.add(gw);
        }

        return wrappers;
    }

    /**
     * @description Retrieves a single game by ID with all related data
     * @param gameId Id of the game to retrieve
     * @return GameWrapper object with court, organizer, and player information
     */
    @AuraEnabled
    public static GameWrapper getGameById(Id gameId) {
        try {
            if (gameId == null) {
                throw new AuraHandledException('ID gry jest wymagane');
            }

            List<Padel_Game__c> games = [
                SELECT Id, Name, Game_Date__c, Game_Time__c, Day_Of_Week__c,
                       Total_Price__c, Price_Per_Person__c, Max_Players__c,
                       Current_Players__c, Status__c, Share_Link__c, Notes__c, Duration__c,
                       Court__r.Court_Name__c, Court__r.Location__c,
                       Organizer__r.Player_Name__c, Organizer__c,
                       (SELECT Id, Player__c, Player__r.Player_Name__c,
                               Payment_Status__c, Registration_Date__c, Is_Organizer__c
                        FROM Game_Registrations__r
                        ORDER BY Registration_Date__c ASC)
                FROM Padel_Game__c
                WHERE Id = :gameId
                LIMIT 1
            ];

            if (games.isEmpty()) {
                throw new AuraHandledException('Nie znaleziono gry');
            }

            List<GameWrapper> wrappers = buildGameWrappers(games);
            return wrappers[0];

        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            throw new AuraHandledException('Błąd podczas pobierania gry: ' + e.getMessage());
        }
    }
}
