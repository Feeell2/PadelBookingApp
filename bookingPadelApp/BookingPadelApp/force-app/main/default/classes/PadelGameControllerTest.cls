/**
 * @description Test class for PadelGameController
 * @author Padel Booking Team
 * @date 2025-10-22
 */
@isTest
private class PadelGameControllerTest {

    /**
     * @description Creates test data for all test methods
     */
    @TestSetup
    static void setupTestData() {
        // Create test games
        List<Padel_Game__c> testGames = new List<Padel_Game__c>();

        testGames.add(new Padel_Game__c(
            Game_Date__c = Date.today().addDays(7),
            Game_Time__c = Time.newInstance(18, 0, 0, 0),
            Court_Name__c = 'Kort 1',
            Total_Price__c = 200,
            Max_Players__c = 4,
            Status__c = 'Dostępna',
            Creator_Email__c = 'organizer@test.com',
            Notes__c = 'Test game 1'
        ));

        testGames.add(new Padel_Game__c(
            Game_Date__c = Date.today().addDays(14),
            Game_Time__c = Time.newInstance(19, 0, 0, 0),
            Court_Name__c = 'Kort 2',
            Total_Price__c = 180,
            Max_Players__c = 4,
            Status__c = 'Dostępna'
        ));

        testGames.add(new Padel_Game__c(
            Game_Date__c = Date.today().addDays(21),
            Game_Time__c = Time.newInstance(20, 0, 0, 0),
            Court_Name__c = 'Kort 3',
            Total_Price__c = 220,
            Max_Players__c = 4,
            Status__c = 'Anulowana'
        ));

        insert testGames;

        // Add 2 players to first game
        List<Padel_Player__c> testPlayers = new List<Padel_Player__c>();

        testPlayers.add(new Padel_Player__c(
            Game__c = testGames[0].Id,
            Player_Name__c = 'Jan Kowalski',
            Email__c = 'jan@test.com',
            Phone__c = '+48123456789',
            Payment_Status__c = 'Zapłacone'
        ));

        testPlayers.add(new Padel_Player__c(
            Game__c = testGames[0].Id,
            Player_Name__c = 'Anna Nowak',
            Email__c = 'anna@test.com',
            Payment_Status__c = 'Niezapłacone'
        ));

        insert testPlayers;
    }

    /**
     * @description Test getAvailableGames returns only non-cancelled games
     */
    @isTest
    static void testGetAvailableGames() {
        Test.startTest();
        List<Padel_Game__c> games = PadelGameController.getAvailableGames();
        Test.stopTest();

        // Should return 2 games (excludes cancelled game)
        System.assertEquals(2, games.size(), 'Should return 2 available games');

        // Verify games are ordered by date
        System.assert(games[0].Game_Date__c <= games[1].Game_Date__c,
                     'Games should be ordered by date');

        // Verify players are included
        System.assertEquals(2, games[0].Padel_Players__r.size(),
                          'First game should have 2 players');

        // Verify no cancelled games
        for (Padel_Game__c game : games) {
            System.assertNotEquals('Anulowana', game.Status__c,
                                  'Should not return cancelled games');
        }
    }

    /**
     * @description Test creating a new game with all required fields
     */
    @isTest
    static void testCreateGame() {
        String gameData = JSON.serialize(new Map<String, Object>{
            'Game_Date__c' => String.valueOf(Date.today().addDays(30)),
            'Game_Time__c' => '18:30',
            'Court_Name__c' => 'Kort 4',
            'Total_Price__c' => 240,
            'Max_Players__c' => 4,
            'Creator_Email__c' => 'creator@test.com',
            'Notes__c' => 'Evening game'
        });

        Test.startTest();
        Id gameId = PadelGameController.createGame(gameData);
        Test.stopTest();

        System.assertNotEquals(null, gameId, 'Game ID should not be null');

        Padel_Game__c createdGame = [
            SELECT Id, Game_Date__c, Game_Time__c, Court_Name__c,
                   Total_Price__c, Max_Players__c, Status__c, Creator_Email__c, Notes__c
            FROM Padel_Game__c
            WHERE Id = :gameId
        ];

        System.assertEquals(Date.today().addDays(30), createdGame.Game_Date__c);
        System.assertEquals(Time.newInstance(18, 30, 0, 0), createdGame.Game_Time__c);
        System.assertEquals('Kort 4', createdGame.Court_Name__c);
        System.assertEquals(240, createdGame.Total_Price__c);
        System.assertEquals(4, createdGame.Max_Players__c);
        System.assertEquals('Dostępna', createdGame.Status__c);
        System.assertEquals('creator@test.com', createdGame.Creator_Email__c);
        System.assertEquals('Evening game', createdGame.Notes__c);
    }

    /**
     * @description Test creating game with minimal required fields (optional fields omitted)
     */
    @isTest
    static void testCreateGameMinimalFields() {
        String gameData = JSON.serialize(new Map<String, Object>{
            'Game_Date__c' => String.valueOf(Date.today().addDays(5)),
            'Game_Time__c' => '19:00',
            'Court_Name__c' => 'Kort 1',
            'Total_Price__c' => 200
        });

        Test.startTest();
        Id gameId = PadelGameController.createGame(gameData);
        Test.stopTest();

        Padel_Game__c createdGame = [
            SELECT Max_Players__c, Status__c, Creator_Email__c
            FROM Padel_Game__c
            WHERE Id = :gameId
        ];

        System.assertEquals(4, createdGame.Max_Players__c, 'Should default to 4 players');
        System.assertEquals('Dostępna', createdGame.Status__c);
        System.assertEquals(null, createdGame.Creator_Email__c);
    }

    /**
     * @description Test creating game without required fields throws error
     */
    @isTest
    static void testCreateGameMissingRequiredFields() {
        String gameData = JSON.serialize(new Map<String, Object>{
            'Game_Time__c' => '18:00'
            // Missing Game_Date__c, Court_Name__c, Total_Price__c
        });

        Test.startTest();
        try {
            PadelGameController.createGame(gameData);
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('wymagana'),
                         'Error message should mention required field');
        }
        Test.stopTest();
    }

    /**
     * @description Test adding a player to a game successfully
     */
    @isTest
    static void testAddPlayerToGame() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];

        String playerData = JSON.serialize(new Map<String, Object>{
            'Player_Name__c' => 'Piotr Wiśniewski',
            'Email__c' => 'piotr@test.com',
            'Phone__c' => '+48987654321'
        });

        Test.startTest();
        Id playerId = PadelGameController.addPlayerToGame(game.Id, playerData);
        Test.stopTest();

        System.assertNotEquals(null, playerId, 'Player ID should not be null');

        Padel_Player__c createdPlayer = [
            SELECT Player_Name__c, Email__c, Phone__c, Payment_Status__c, Game__c
            FROM Padel_Player__c
            WHERE Id = :playerId
        ];

        System.assertEquals('Piotr Wiśniewski', createdPlayer.Player_Name__c);
        System.assertEquals('piotr@test.com', createdPlayer.Email__c);
        System.assertEquals('+48987654321', createdPlayer.Phone__c);
        System.assertEquals('Niezapłacone', createdPlayer.Payment_Status__c);
        System.assertEquals(game.Id, createdPlayer.Game__c);
    }

    /**
     * @description Test adding player without phone (optional field)
     */
    @isTest
    static void testAddPlayerWithoutPhone() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];

        String playerData = JSON.serialize(new Map<String, Object>{
            'Player_Name__c' => 'Test Player',
            'Email__c' => 'test@example.com'
        });

        Test.startTest();
        Id playerId = PadelGameController.addPlayerToGame(game.Id, playerData);
        Test.stopTest();

        Padel_Player__c createdPlayer = [
            SELECT Phone__c
            FROM Padel_Player__c
            WHERE Id = :playerId
        ];

        System.assertEquals(null, createdPlayer.Phone__c, 'Phone should be null when not provided');
    }

    /**
     * @description Test duplicate email rejection for same game
     */
    @isTest
    static void testAddPlayerDuplicateEmail() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];

        String playerData = JSON.serialize(new Map<String, Object>{
            'Player_Name__c' => 'Duplicate Test',
            'Email__c' => 'jan@test.com' // Email already exists in test data
        });

        Test.startTest();
        try {
            PadelGameController.addPlayerToGame(game.Id, playerData);
            System.assert(false, 'Should have thrown exception for duplicate email');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('zarejestrowany'),
                         'Error should mention duplicate registration');
        }
        Test.stopTest();
    }

    /**
     * @description Test adding player to full game is rejected
     */
    @isTest
    static void testAddPlayerToFullGame() {
        // Create a game with max 2 players
        Padel_Game__c fullGame = new Padel_Game__c(
            Game_Date__c = Date.today().addDays(3),
            Game_Time__c = Time.newInstance(17, 0, 0, 0),
            Court_Name__c = 'Kort 1',
            Total_Price__c = 100,
            Max_Players__c = 2,
            Status__c = 'Dostępna'
        );
        insert fullGame;

        // Add 2 players to fill it
        List<Padel_Player__c> players = new List<Padel_Player__c>{
            new Padel_Player__c(
                Game__c = fullGame.Id,
                Player_Name__c = 'Player 1',
                Email__c = 'player1@test.com'
            ),
            new Padel_Player__c(
                Game__c = fullGame.Id,
                Player_Name__c = 'Player 2',
                Email__c = 'player2@test.com'
            )
        };
        insert players;

        String playerData = JSON.serialize(new Map<String, Object>{
            'Player_Name__c' => 'Player 3',
            'Email__c' => 'player3@test.com'
        });

        Test.startTest();
        try {
            PadelGameController.addPlayerToGame(fullGame.Id, playerData);
            System.assert(false, 'Should have thrown exception for full game');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('pełna'),
                         'Error should mention game is full');
        }
        Test.stopTest();
    }

    /**
     * @description Test adding player to cancelled game is rejected
     */
    @isTest
    static void testAddPlayerToCancelledGame() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Anulowana' LIMIT 1];

        String playerData = JSON.serialize(new Map<String, Object>{
            'Player_Name__c' => 'Test Player',
            'Email__c' => 'test@test.com'
        });

        Test.startTest();
        try {
            PadelGameController.addPlayerToGame(game.Id, playerData);
            System.assert(false, 'Should have thrown exception for cancelled game');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('anulowana'),
                         'Error should mention game is cancelled');
        }
        Test.stopTest();
    }

    /**
     * @description Test game status updates to 'Zarezerwowana' when 3/4 players
     */
    @isTest
    static void testGameStatusUpdatesToReserved() {
        Padel_Game__c game = [SELECT Id, Current_Players__c FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        System.assertEquals(2, game.Current_Players__c, 'Should start with 2 players');

        String playerData = JSON.serialize(new Map<String, Object>{
            'Player_Name__c' => 'Third Player',
            'Email__c' => 'third@test.com'
        });

        Test.startTest();
        PadelGameController.addPlayerToGame(game.Id, playerData);
        Test.stopTest();

        Padel_Game__c updatedGame = [SELECT Status__c, Current_Players__c FROM Padel_Game__c WHERE Id = :game.Id];
        System.assertEquals(3, updatedGame.Current_Players__c);
        System.assertEquals('Zarezerwowana', updatedGame.Status__c);
    }

    /**
     * @description Test game status updates to 'Pełna' when all players joined
     */
    @isTest
    static void testGameStatusUpdatesToFull() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];

        // Add 2 more players to make it full (already has 2)
        List<String> playerDataList = new List<String>{
            JSON.serialize(new Map<String, Object>{
                'Player_Name__c' => 'Player 3',
                'Email__c' => 'player3@test.com'
            }),
            JSON.serialize(new Map<String, Object>{
                'Player_Name__c' => 'Player 4',
                'Email__c' => 'player4@test.com'
            })
        };

        Test.startTest();
        for (String playerData : playerDataList) {
            PadelGameController.addPlayerToGame(game.Id, playerData);
        }
        Test.stopTest();

        Padel_Game__c updatedGame = [SELECT Status__c, Current_Players__c FROM Padel_Game__c WHERE Id = :game.Id];
        System.assertEquals(4, updatedGame.Current_Players__c);
        System.assertEquals('Pełna', updatedGame.Status__c);
    }

    /**
     * @description Test updating player payment status
     */
    @isTest
    static void testUpdatePlayerPaymentStatus() {
        Padel_Player__c player = [
            SELECT Id, Payment_Status__c
            FROM Padel_Player__c
            WHERE Payment_Status__c = 'Niezapłacone'
            LIMIT 1
        ];

        Test.startTest();
        PadelGameController.updatePlayerPaymentStatus(player.Id, 'Zapłacone');
        Test.stopTest();

        Padel_Player__c updatedPlayer = [
            SELECT Payment_Status__c
            FROM Padel_Player__c
            WHERE Id = :player.Id
        ];

        System.assertEquals('Zapłacone', updatedPlayer.Payment_Status__c);
    }

    /**
     * @description Test updating payment status with invalid value
     */
    @isTest
    static void testUpdatePaymentStatusInvalidValue() {
        Padel_Player__c player = [SELECT Id FROM Padel_Player__c LIMIT 1];

        Test.startTest();
        try {
            PadelGameController.updatePlayerPaymentStatus(player.Id, 'InvalidStatus');
            System.assert(false, 'Should have thrown exception for invalid status');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Nieprawidłowy'),
                         'Error should mention invalid status');
        }
        Test.stopTest();
    }

    /**
     * @description Test removing a player from game
     */
    @isTest
    static void testRemovePlayerFromGame() {
        Padel_Player__c player = [SELECT Id, Game__c FROM Padel_Player__c LIMIT 1];
        Id gameId = player.Game__c;

        Integer initialCount = [SELECT COUNT() FROM Padel_Player__c WHERE Game__c = :gameId];

        Test.startTest();
        PadelGameController.removePlayerFromGame(player.Id);
        Test.stopTest();

        Integer finalCount = [SELECT COUNT() FROM Padel_Player__c WHERE Game__c = :gameId];
        System.assertEquals(initialCount - 1, finalCount, 'Player count should decrease by 1');

        List<Padel_Player__c> deletedPlayer = [SELECT Id FROM Padel_Player__c WHERE Id = :player.Id];
        System.assertEquals(0, deletedPlayer.size(), 'Player should be deleted');
    }

    /**
     * @description Test game status updates when player is removed
     */
    @isTest
    static void testGameStatusUpdatesAfterPlayerRemoval() {
        // Create game with 4 players (full)
        Padel_Game__c fullGame = new Padel_Game__c(
            Game_Date__c = Date.today().addDays(10),
            Game_Time__c = Time.newInstance(18, 0, 0, 0),
            Court_Name__c = 'Kort 2',
            Total_Price__c = 200,
            Max_Players__c = 4,
            Status__c = 'Pełna'
        );
        insert fullGame;

        List<Padel_Player__c> players = new List<Padel_Player__c>();
        for (Integer i = 1; i <= 4; i++) {
            players.add(new Padel_Player__c(
                Game__c = fullGame.Id,
                Player_Name__c = 'Player ' + i,
                Email__c = 'player' + i + '@full.com'
            ));
        }
        insert players;

        Test.startTest();
        PadelGameController.removePlayerFromGame(players[0].Id);
        Test.stopTest();

        Padel_Game__c updatedGame = [SELECT Status__c, Current_Players__c FROM Padel_Game__c WHERE Id = :fullGame.Id];
        System.assertEquals(3, updatedGame.Current_Players__c);
        System.assertEquals('Zarezerwowana', updatedGame.Status__c,
                          'Status should change from Pełna to Zarezerwowana');
    }

    /**
     * @description Test deleting a game
     */
    @isTest
    static void testDeleteGame() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        Id gameId = game.Id;

        // Verify game has players
        Integer playerCount = [SELECT COUNT() FROM Padel_Player__c WHERE Game__c = :gameId];
        System.assert(playerCount > 0, 'Game should have players');

        Test.startTest();
        PadelGameController.deleteGame(gameId);
        Test.stopTest();

        // Verify game is deleted
        List<Padel_Game__c> deletedGames = [SELECT Id FROM Padel_Game__c WHERE Id = :gameId];
        System.assertEquals(0, deletedGames.size(), 'Game should be deleted');

        // Verify players are cascade deleted (Master-Detail)
        Integer remainingPlayers = [SELECT COUNT() FROM Padel_Player__c WHERE Game__c = :gameId];
        System.assertEquals(0, remainingPlayers, 'Players should be cascade deleted');
    }

    /**
     * @description Test getGameById returns correct game with players
     */
    @isTest
    static void testGetGameById() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];

        Test.startTest();
        Padel_Game__c retrievedGame = PadelGameController.getGameById(game.Id);
        Test.stopTest();

        System.assertNotEquals(null, retrievedGame, 'Game should be retrieved');
        System.assertEquals(game.Id, retrievedGame.Id);
        System.assertNotEquals(null, retrievedGame.Padel_Players__r, 'Players should be included');
        System.assert(retrievedGame.Padel_Players__r.size() > 0, 'Should have players');
    }

    /**
     * @description Test bulk operations (governor limit testing)
     */
    @isTest
    static void testBulkOperations() {
        // Create 50 games
        List<Padel_Game__c> bulkGames = new List<Padel_Game__c>();
        for (Integer i = 0; i < 50; i++) {
            bulkGames.add(new Padel_Game__c(
                Game_Date__c = Date.today().addDays(i + 1),
                Game_Time__c = Time.newInstance(18, 0, 0, 0),
                Court_Name__c = 'Kort ' + Math.mod(i, 4) + 1,
                Total_Price__c = 200,
                Max_Players__c = 4,
                Status__c = 'Dostępna'
            ));
        }
        insert bulkGames;

        Test.startTest();
        List<Padel_Game__c> retrievedGames = PadelGameController.getAvailableGames();
        Test.stopTest();

        // Should retrieve games without hitting governor limits
        System.assert(retrievedGames.size() > 0, 'Should retrieve games');
        System.assert(Limits.getQueries() < Limits.getLimitQueries(),
                     'Should not exceed SOQL query limits');
    }

    /**
     * @description Test error handling for invalid game ID
     */
    @isTest
    static void testGetGameByIdInvalidId() {
        Test.startTest();
        try {
            PadelGameController.getGameById('001000000000000AAA'); // Invalid ID
            System.assert(false, 'Should have thrown exception');
        } catch (Exception e) {
            System.assert(e instanceof AuraHandledException,
                         'Should throw AuraHandledException');
        }
        Test.stopTest();
    }
}
