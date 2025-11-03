/**
 * @description Test class for PadelGameController - Junction Object Pattern
 * @author Padel Booking Team
 * @date 2025-10-27
 */
@isTest
private class PadelGameControllerTest {

    /**
     * @description Creates test data for all test methods
     */
    @TestSetup
    static void setupTestData() {
        // Create test courts
        List<Padel_Court__c> courts = new List<Padel_Court__c>{
            new Padel_Court__c(Court_Name__c = 'Kort Centrum 1', Court_Number__c = 1, Location__c = 'Centrum'),
            new Padel_Court__c(Court_Name__c = 'Kort Centrum 2', Court_Number__c = 2, Location__c = 'Centrum'),
            new Padel_Court__c(Court_Name__c = 'Kort Północ 1', Court_Number__c = 1, Location__c = 'Północ')
        };
        insert courts;

        // Create test players
        List<Padel_Player__c> players = new List<Padel_Player__c>{
            new Padel_Player__c(Player_Name__c = 'Jan Kowalski'),
            new Padel_Player__c(Player_Name__c = 'Anna Nowak'),
            new Padel_Player__c(Player_Name__c = 'Piotr Wiśniewski'),
            new Padel_Player__c(Player_Name__c = 'Maria Zielińska')
        };
        insert players;

        // Create test games
        List<Padel_Game__c> games = new List<Padel_Game__c>{
            new Padel_Game__c(
                Game_Date__c = Date.today().addDays(7),
                Game_Time__c = Time.newInstance(18, 0, 0, 0),
                Court__c = courts[0].Id,
                Organizer__c = players[0].Id,
                Total_Price__c = 200,
                Max_Players__c = 4,
                Status__c = 'Dostępna',
                Notes__c = 'Test game 1'
            ),
            new Padel_Game__c(
                Game_Date__c = Date.today().addDays(14),
                Game_Time__c = Time.newInstance(19, 0, 0, 0),
                Court__c = courts[1].Id,
                Organizer__c = players[1].Id,
                Total_Price__c = 180,
                Max_Players__c = 4,
                Status__c = 'Dostępna'
            ),
            new Padel_Game__c(
                Game_Date__c = Date.today().addDays(21),
                Game_Time__c = Time.newInstance(20, 0, 0, 0),
                Court__c = courts[2].Id,
                Organizer__c = players[2].Id,
                Total_Price__c = 220,
                Max_Players__c = 4,
                Status__c = 'Anulowana'
            )
        };
        insert games;

        // Create registrations for first game
        List<Padel_Game_Registration__c> registrations = new List<Padel_Game_Registration__c>{
            new Padel_Game_Registration__c(
                Game__c = games[0].Id,
                Player__c = players[0].Id,
                Is_Organizer__c = true,
                Payment_Status__c = 'Zapłacone',
                Registration_Date__c = System.now()
            ),
            new Padel_Game_Registration__c(
                Game__c = games[0].Id,
                Player__c = players[1].Id,
                Is_Organizer__c = false,
                Payment_Status__c = 'Niezapłacone',
                Registration_Date__c = System.now()
            )
        };
        insert registrations;

        // Create registration for second game (organizer only)
        insert new Padel_Game_Registration__c(
            Game__c = games[1].Id,
            Player__c = players[1].Id,
            Is_Organizer__c = true,
            Payment_Status__c = 'Niezapłacone',
            Registration_Date__c = System.now()
        );
    }

    // ========================================================================
    // GAME OPERATIONS TESTS
    // ========================================================================

    @isTest
    static void testGetAvailableGames() {
        Test.startTest();
        List<PadelGameController.GameWrapper> games = PadelGameController.getAvailableGames();
        Test.stopTest();

        System.assertEquals(2, games.size(), 'Should return 2 available games');
        System.assert(games[0].gameDate <= games[1].gameDate, 'Games should be ordered by date');

        // Verify first game has players
        System.assertEquals(2, games[0].players.size(), 'First game should have 2 players');
        System.assertNotEquals(null, games[0].courtName, 'Court name should be populated');
        System.assertNotEquals(null, games[0].organizerName, 'Organizer name should be populated');
    }

    @isTest
    static void testCreateGame() {
        Padel_Court__c court = [SELECT Id FROM Padel_Court__c LIMIT 1];
        Padel_Player__c organizer = [SELECT Id FROM Padel_Player__c WHERE Player_Name__c = 'Maria Zielińska'];

        Test.startTest();
        Id gameId = PadelGameController.createGame(
            court.Id,
            organizer.Id,
            String.valueOf(Date.today().addDays(30)),
            '18:30',
            240,
            4,
            'Evening game'
        );
        Test.stopTest();

        System.assertNotEquals(null, gameId, 'Game ID should not be null');

        Padel_Game__c createdGame = [
            SELECT Id, Game_Date__c, Game_Time__c, Court__c, Organizer__c,
                   Total_Price__c, Max_Players__c, Status__c, Notes__c
            FROM Padel_Game__c
            WHERE Id = :gameId
        ];

        System.assertEquals(Date.today().addDays(30), createdGame.Game_Date__c);
        System.assertEquals(Time.newInstance(18, 30, 0, 0), createdGame.Game_Time__c);
        System.assertEquals(court.Id, createdGame.Court__c);
        System.assertEquals(organizer.Id, createdGame.Organizer__c);
        System.assertEquals('Dostępna', createdGame.Status__c);
        System.assertEquals('Evening game', createdGame.Notes__c);

        // Verify organizer registration was created
        List<Padel_Game_Registration__c> registrations = [
            SELECT Id, Player__c, Is_Organizer__c
            FROM Padel_Game_Registration__c
            WHERE Game__c = :gameId
        ];
        System.assertEquals(1, registrations.size(), 'Should have 1 registration');
        System.assertEquals(true, registrations[0].Is_Organizer__c, 'Should be marked as organizer');
    }

    @isTest
    static void testCreateGameMissingRequiredFields() {
        Test.startTest();
        try {
            PadelGameController.createGame(null, null, null, null, null, null, null);
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('wymagany'), 'Error should mention required field');
        }
        Test.stopTest();
    }

    @isTest
    static void testAddPlayerToGame() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        Padel_Player__c player = [SELECT Id FROM Padel_Player__c WHERE Player_Name__c = 'Piotr Wiśniewski'];

        Test.startTest();
        Id registrationId = PadelGameController.addPlayerToGame(game.Id, player.Id);
        Test.stopTest();

        System.assertNotEquals(null, registrationId, 'Registration ID should not be null');

        Padel_Game_Registration__c registration = [
            SELECT Id, Game__c, Player__c, Is_Organizer__c, Payment_Status__c
            FROM Padel_Game_Registration__c
            WHERE Id = :registrationId
        ];

        System.assertEquals(game.Id, registration.Game__c);
        System.assertEquals(player.Id, registration.Player__c);
        System.assertEquals(false, registration.Is_Organizer__c);
        System.assertEquals('Niezapłacone', registration.Payment_Status__c);
    }

    @isTest
    static void testAddPlayerDuplicateRegistration() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        Padel_Player__c player = [SELECT Id FROM Padel_Player__c WHERE Player_Name__c = 'Jan Kowalski'];

        Test.startTest();
        try {
            PadelGameController.addPlayerToGame(game.Id, player.Id);
            System.assert(false, 'Should have thrown exception for duplicate registration');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('zapisany'), 'Error should mention duplicate');
        }
        Test.stopTest();
    }

    @isTest
    static void testAddPlayerToFullGame() {
        Padel_Court__c court = [SELECT Id FROM Padel_Court__c LIMIT 1];
        List<Padel_Player__c> players = [SELECT Id FROM Padel_Player__c LIMIT 4];

        // Create game with 2 player capacity
        Padel_Game__c fullGame = new Padel_Game__c(
            Game_Date__c = Date.today().addDays(3),
            Game_Time__c = Time.newInstance(17, 0, 0, 0),
            Court__c = court.Id,
            Organizer__c = players[0].Id,
            Total_Price__c = 100,
            Max_Players__c = 2,
            Status__c = 'Dostępna'
        );
        insert fullGame;

        // Fill the game
        List<Padel_Game_Registration__c> regs = new List<Padel_Game_Registration__c>{
            new Padel_Game_Registration__c(Game__c = fullGame.Id, Player__c = players[0].Id, Is_Organizer__c = true),
            new Padel_Game_Registration__c(Game__c = fullGame.Id, Player__c = players[1].Id, Is_Organizer__c = false)
        };
        insert regs;

        Test.startTest();
        try {
            PadelGameController.addPlayerToGame(fullGame.Id, players[2].Id);
            System.assert(false, 'Should have thrown exception for full game');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('pełna'), 'Error should mention game is full');
        }
        Test.stopTest();
    }

    @isTest
    static void testAddPlayerToCancelledGame() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Anulowana' LIMIT 1];
        Padel_Player__c player = [SELECT Id FROM Padel_Player__c LIMIT 1];

        Test.startTest();
        try {
            PadelGameController.addPlayerToGame(game.Id, player.Id);
            System.assert(false, 'Should have thrown exception for cancelled game');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('anulowana'), 'Error should mention cancelled');
        }
        Test.stopTest();
    }

    @isTest
    static void testGameStatusUpdatesToReserved() {
        Padel_Game__c game = [SELECT Id, Current_Players__c FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        Padel_Player__c player = [SELECT Id FROM Padel_Player__c WHERE Player_Name__c = 'Piotr Wiśniewski'];

        System.assertEquals(2, game.Current_Players__c, 'Should start with 2 players');

        Test.startTest();
        PadelGameController.addPlayerToGame(game.Id, player.Id);
        Test.stopTest();

        Padel_Game__c updatedGame = [SELECT Status__c, Current_Players__c FROM Padel_Game__c WHERE Id = :game.Id];
        System.assertEquals(3, updatedGame.Current_Players__c);
        System.assertEquals('Zarezerwowana', updatedGame.Status__c);
    }

    @isTest
    static void testGameStatusUpdatesToFull() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        List<Padel_Player__c> players = [SELECT Id FROM Padel_Player__c WHERE Player_Name__c IN ('Piotr Wiśniewski', 'Maria Zielińska')];

        Test.startTest();
        PadelGameController.addPlayerToGame(game.Id, players[0].Id);
        PadelGameController.addPlayerToGame(game.Id, players[1].Id);
        Test.stopTest();

        Padel_Game__c updatedGame = [SELECT Status__c, Current_Players__c FROM Padel_Game__c WHERE Id = :game.Id];
        System.assertEquals(4, updatedGame.Current_Players__c);
        System.assertEquals('Pełna', updatedGame.Status__c);
    }

    // ========================================================================
    // PLAYER REMOVAL AND ORGANIZER TRANSFER TESTS
    // ========================================================================

    @isTest
    static void testRemovePlayerFromGame() {
        Padel_Game_Registration__c registration = [
            SELECT Id, Game__c, Is_Organizer__c
            FROM Padel_Game_Registration__c
            WHERE Is_Organizer__c = false
            LIMIT 1
        ];
        Id gameId = registration.Game__c;

        Integer initialCount = [SELECT COUNT() FROM Padel_Game_Registration__c WHERE Game__c = :gameId];

        Test.startTest();
        PadelGameController.removePlayerFromGame(registration.Id, false);
        Test.stopTest();

        Integer finalCount = [SELECT COUNT() FROM Padel_Game_Registration__c WHERE Game__c = :gameId];
        System.assertEquals(initialCount - 1, finalCount, 'Registration count should decrease by 1');

        List<Padel_Game_Registration__c> deletedReg = [SELECT Id FROM Padel_Game_Registration__c WHERE Id = :registration.Id];
        System.assertEquals(0, deletedReg.size(), 'Registration should be deleted');
    }

    @isTest
    static void testRemoveOrganizerWithAutoTransfer() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        Padel_Game_Registration__c organizerReg = [
            SELECT Id, Player__c
            FROM Padel_Game_Registration__c
            WHERE Game__c = :game.Id AND Is_Organizer__c = true
            LIMIT 1
        ];

        Test.startTest();
        PadelGameController.removePlayerFromGame(organizerReg.Id, true);
        Test.stopTest();

        // Verify organizer was transferred
        Padel_Game__c updatedGame = [SELECT Id, Organizer__c FROM Padel_Game__c WHERE Id = :game.Id];
        System.assertNotEquals(organizerReg.Player__c, updatedGame.Organizer__c, 'Organizer should have changed');

        // Verify new organizer registration has flag set
        Padel_Game_Registration__c newOrganizerReg = [
            SELECT Id, Is_Organizer__c
            FROM Padel_Game_Registration__c
            WHERE Game__c = :game.Id AND Player__c = :updatedGame.Organizer__c
            LIMIT 1
        ];
        System.assertEquals(true, newOrganizerReg.Is_Organizer__c, 'New organizer should have flag set');
    }

    @isTest
    static void testRemoveLastPlayerCancelsGame() {
        // Create game with only organizer
        Padel_Court__c court = [SELECT Id FROM Padel_Court__c LIMIT 1];
        Padel_Player__c player = [SELECT Id FROM Padel_Player__c LIMIT 1];

        Padel_Game__c singlePlayerGame = new Padel_Game__c(
            Game_Date__c = Date.today().addDays(5),
            Game_Time__c = Time.newInstance(20, 0, 0, 0),
            Court__c = court.Id,
            Organizer__c = player.Id,
            Total_Price__c = 150,
            Max_Players__c = 4,
            Status__c = 'Dostępna'
        );
        insert singlePlayerGame;

        Padel_Game_Registration__c singleReg = new Padel_Game_Registration__c(
            Game__c = singlePlayerGame.Id,
            Player__c = player.Id,
            Is_Organizer__c = true
        );
        insert singleReg;

        Test.startTest();
        PadelGameController.removePlayerFromGame(singleReg.Id, true);
        Test.stopTest();

        Padel_Game__c updatedGame = [SELECT Status__c FROM Padel_Game__c WHERE Id = :singlePlayerGame.Id];
        System.assertEquals('Anulowana', updatedGame.Status__c, 'Game should be cancelled when last player removed');
    }

    @isTest
    static void testGameStatusUpdatesAfterPlayerRemoval() {
        // Create full game
        Padel_Court__c court = [SELECT Id FROM Padel_Court__c LIMIT 1];
        List<Padel_Player__c> players = [SELECT Id FROM Padel_Player__c LIMIT 4];

        Padel_Game__c fullGame = new Padel_Game__c(
            Game_Date__c = Date.today().addDays(10),
            Game_Time__c = Time.newInstance(18, 0, 0, 0),
            Court__c = court.Id,
            Organizer__c = players[0].Id,
            Total_Price__c = 200,
            Max_Players__c = 4,
            Status__c = 'Pełna'
        );
        insert fullGame;

        List<Padel_Game_Registration__c> regs = new List<Padel_Game_Registration__c>();
        for (Integer i = 0; i < 4; i++) {
            regs.add(new Padel_Game_Registration__c(
                Game__c = fullGame.Id,
                Player__c = players[i].Id,
                Is_Organizer__c = (i == 0)
            ));
        }
        insert regs;

        Test.startTest();
        PadelGameController.removePlayerFromGame(regs[1].Id, false);
        Test.stopTest();

        Padel_Game__c updatedGame = [SELECT Status__c, Current_Players__c FROM Padel_Game__c WHERE Id = :fullGame.Id];
        System.assertEquals(3, updatedGame.Current_Players__c);
        System.assertEquals('Zarezerwowana', updatedGame.Status__c);
    }

    // ========================================================================
    // PAYMENT AND ORGANIZER TESTS
    // ========================================================================

    @isTest
    static void testUpdatePaymentStatus() {
        Padel_Game_Registration__c registration = [
            SELECT Id, Payment_Status__c
            FROM Padel_Game_Registration__c
            WHERE Payment_Status__c = 'Niezapłacone'
            LIMIT 1
        ];

        Test.startTest();
        PadelGameController.updatePaymentStatus(registration.Id, 'Zapłacone');
        Test.stopTest();

        Padel_Game_Registration__c updatedReg = [
            SELECT Payment_Status__c
            FROM Padel_Game_Registration__c
            WHERE Id = :registration.Id
        ];

        System.assertEquals('Zapłacone', updatedReg.Payment_Status__c);
    }

    @isTest
    static void testUpdatePaymentStatusInvalidValue() {
        Padel_Game_Registration__c registration = [SELECT Id FROM Padel_Game_Registration__c LIMIT 1];

        Test.startTest();
        try {
            PadelGameController.updatePaymentStatus(registration.Id, 'InvalidStatus');
            System.assert(false, 'Should have thrown exception for invalid status');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Nieprawidłowy'), 'Error should mention invalid status');
        }
        Test.stopTest();
    }

    @isTest
    static void testUpdatePlayerPaymentStatus() {
        // Get a game with registrations
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        Padel_Game_Registration__c registration = [
            SELECT Id, Player__c, Payment_Status__c, Game__c
            FROM Padel_Game_Registration__c
            WHERE Game__c = :game.Id AND Payment_Status__c = 'Niezapłacone'
            LIMIT 1
        ];

        Test.startTest();
        PadelGameController.updatePlayerPaymentStatus(registration.Game__c, registration.Player__c, 'Zapłacone');
        Test.stopTest();

        // Verify payment status updated
        Padel_Game_Registration__c updatedReg = [
            SELECT Payment_Status__c
            FROM Padel_Game_Registration__c
            WHERE Id = :registration.Id
        ];

        System.assertEquals('Zapłacone', updatedReg.Payment_Status__c, 'Payment status should be updated to Zapłacone');
    }

    @isTest
    static void testUpdatePlayerPaymentStatusPlayerNotRegistered() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        Padel_Player__c unregisteredPlayer = [
            SELECT Id
            FROM Padel_Player__c
            WHERE Id NOT IN (SELECT Player__c FROM Padel_Game_Registration__c WHERE Game__c = :game.Id)
            LIMIT 1
        ];

        Test.startTest();
        try {
            PadelGameController.updatePlayerPaymentStatus(game.Id, unregisteredPlayer.Id, 'Zapłacone');
            System.assert(false, 'Should have thrown exception for unregistered player');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('Nie znaleziono rejestracji'), 'Error should mention registration not found');
        }
        Test.stopTest();
    }

    @isTest
    static void testChangeOrganizer() {
        Padel_Game__c game = [SELECT Id, Organizer__c FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        Padel_Game_Registration__c newOrganizerReg = [
            SELECT Id, Player__c
            FROM Padel_Game_Registration__c
            WHERE Game__c = :game.Id AND Is_Organizer__c = false
            LIMIT 1
        ];

        Id oldOrganizerId = game.Organizer__c;

        Test.startTest();
        PadelGameController.changeOrganizer(game.Id, newOrganizerReg.Player__c);
        Test.stopTest();

        Padel_Game__c updatedGame = [SELECT Organizer__c FROM Padel_Game__c WHERE Id = :game.Id];
        System.assertEquals(newOrganizerReg.Player__c, updatedGame.Organizer__c, 'Organizer should have changed');

        // Verify old organizer flag removed
        Padel_Game_Registration__c oldOrganizerReg = [
            SELECT Is_Organizer__c
            FROM Padel_Game_Registration__c
            WHERE Game__c = :game.Id AND Player__c = :oldOrganizerId
            LIMIT 1
        ];
        System.assertEquals(false, oldOrganizerReg.Is_Organizer__c, 'Old organizer flag should be removed');

        // Verify new organizer flag set
        Padel_Game_Registration__c updatedNewOrgReg = [
            SELECT Is_Organizer__c
            FROM Padel_Game_Registration__c
            WHERE Id = :newOrganizerReg.Id
        ];
        System.assertEquals(true, updatedNewOrgReg.Is_Organizer__c, 'New organizer flag should be set');
    }

    @isTest
    static void testChangeOrganizerToUnregisteredPlayer() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        Padel_Player__c unregisteredPlayer = [
            SELECT Id FROM Padel_Player__c WHERE Player_Name__c = 'Maria Zielińska'
        ];

        Test.startTest();
        try {
            PadelGameController.changeOrganizer(game.Id, unregisteredPlayer.Id);
            System.assert(false, 'Should have thrown exception');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('zapisany'), 'Error should mention player must be registered');
        }
        Test.stopTest();
    }

    // ========================================================================
    // PLAYER AND COURT OPERATIONS TESTS
    // ========================================================================

    @isTest
    static void testGetPlayers() {
        Test.startTest();
        List<PadelGameController.PlayerOption> players = PadelGameController.getPlayers('');
        Test.stopTest();

        System.assert(players.size() >= 4, 'Should return at least 4 players');
        System.assertNotEquals(null, players[0].playerName, 'Player name should be populated');
    }

    @isTest
    static void testGetPlayersWithSearch() {
        Test.startTest();
        List<PadelGameController.PlayerOption> players = PadelGameController.getPlayers('Jan');
        Test.stopTest();

        System.assertEquals(1, players.size(), 'Should return 1 player matching "Jan"');
        System.assert(players[0].playerName.contains('Jan'), 'Player name should contain search term');
    }

    @isTest
    static void testCreatePlayer() {
        Test.startTest();
        Id playerId = PadelGameController.createPlayer('Nowy Gracz');
        Test.stopTest();

        System.assertNotEquals(null, playerId, 'Player ID should not be null');

        Padel_Player__c createdPlayer = [SELECT Player_Name__c FROM Padel_Player__c WHERE Id = :playerId];
        System.assertEquals('Nowy Gracz', createdPlayer.Player_Name__c);
    }

    @isTest
    static void testCreatePlayerDuplicateName() {
        Test.startTest();
        try {
            PadelGameController.createPlayer('Jan Kowalski'); // Already exists in test data
            System.assert(false, 'Should have thrown exception for duplicate name');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('istnieje'), 'Error should mention duplicate');
        }
        Test.stopTest();
    }

    @isTest
    static void testGetCourts() {
        Test.startTest();
        List<PadelGameController.CourtOption> courts = PadelGameController.getCourts('');
        Test.stopTest();

        System.assertEquals(3, courts.size(), 'Should return 3 courts');
        System.assertNotEquals(null, courts[0].courtName, 'Court name should be populated');
    }

    @isTest
    static void testGetCourtsWithSearch() {
        Test.startTest();
        List<PadelGameController.CourtOption> courts = PadelGameController.getCourts('Centrum');
        Test.stopTest();

        System.assertEquals(2, courts.size(), 'Should return 2 courts matching "Centrum"');
    }

    @isTest
    static void testCreateCourt() {
        Test.startTest();
        Id courtId = PadelGameController.createCourt('Nowy Kort', 5, 'Południe');
        Test.stopTest();

        System.assertNotEquals(null, courtId, 'Court ID should not be null');

        Padel_Court__c createdCourt = [
            SELECT Court_Name__c, Court_Number__c, Location__c
            FROM Padel_Court__c
            WHERE Id = :courtId
        ];
        System.assertEquals('Nowy Kort', createdCourt.Court_Name__c);
        System.assertEquals(5, createdCourt.Court_Number__c);
        System.assertEquals('Południe', createdCourt.Location__c);
    }

    @isTest
    static void testCreateCourtDuplicateName() {
        Test.startTest();
        try {
            PadelGameController.createCourt('Kort Centrum 1', null, null); // Already exists
            System.assert(false, 'Should have thrown exception for duplicate name');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('istnieje'), 'Error should mention duplicate');
        }
        Test.stopTest();
    }

    // ========================================================================
    // GAME REGISTRATION AND DELETE TESTS
    // ========================================================================

    @isTest
    static void testGetGameRegistrations() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];

        Test.startTest();
        List<PadelGameController.PlayerWrapper> registrations = PadelGameController.getGameRegistrations(game.Id);
        Test.stopTest();

        System.assertEquals(2, registrations.size(), 'Should return 2 registrations');
        System.assertNotEquals(null, registrations[0].playerName, 'Player name should be populated');
        System.assertNotEquals(null, registrations[0].registrationId, 'Registration ID should be populated');

        // Verify organizer is included
        Boolean hasOrganizer = false;
        for (PadelGameController.PlayerWrapper pw : registrations) {
            if (pw.isOrganizer) {
                hasOrganizer = true;
                break;
            }
        }
        System.assert(hasOrganizer, 'Should have an organizer in registrations');
    }

    @isTest
    static void testDeleteGame() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];
        Id gameId = game.Id;

        Integer regCount = [SELECT COUNT() FROM Padel_Game_Registration__c WHERE Game__c = :gameId];
        System.assert(regCount > 0, 'Game should have registrations');

        Test.startTest();
        PadelGameController.deleteGame(gameId);
        Test.stopTest();

        List<Padel_Game__c> deletedGames = [SELECT Id FROM Padel_Game__c WHERE Id = :gameId];
        System.assertEquals(0, deletedGames.size(), 'Game should be deleted');

        Integer remainingRegs = [SELECT COUNT() FROM Padel_Game_Registration__c WHERE Game__c = :gameId];
        System.assertEquals(0, remainingRegs, 'Registrations should be deleted');
    }

    // ========================================================================
    // BULK OPERATIONS AND GOVERNOR LIMITS TESTS
    // ========================================================================

    @isTest
    static void testBulkOperations() {
        Padel_Court__c court = [SELECT Id FROM Padel_Court__c LIMIT 1];
        Padel_Player__c organizer = [SELECT Id FROM Padel_Player__c LIMIT 1];

        // Create 50 games
        List<Padel_Game__c> bulkGames = new List<Padel_Game__c>();
        for (Integer i = 0; i < 50; i++) {
            bulkGames.add(new Padel_Game__c(
                Game_Date__c = Date.today().addDays(i + 1),
                Game_Time__c = Time.newInstance(18, 0, 0, 0),
                Court__c = court.Id,
                Organizer__c = organizer.Id,
                Total_Price__c = 200,
                Max_Players__c = 4,
                Status__c = 'Dostępna'
            ));
        }
        insert bulkGames;

        Test.startTest();
        List<PadelGameController.GameWrapper> retrievedGames = PadelGameController.getAvailableGames();
        Test.stopTest();

        System.assert(retrievedGames.size() > 0, 'Should retrieve games');
        System.assert(Limits.getQueries() < Limits.getLimitQueries(), 'Should not exceed SOQL query limits');
    }

    // ========================================================================
    // DEPRECATED METHOD TEST (backward compatibility)
    // ========================================================================

    @isTest
    static void testGetGameById() {
        Padel_Game__c game = [SELECT Id FROM Padel_Game__c WHERE Status__c = 'Dostępna' LIMIT 1];

        Test.startTest();
        PadelGameController.GameWrapper retrievedGame = PadelGameController.getGameById(game.Id);
        Test.stopTest();

        System.assertNotEquals(null, retrievedGame, 'Game should be retrieved');
        System.assertEquals(game.Id, retrievedGame.gameId);
        System.assertNotEquals(null, retrievedGame.players, 'Players list should not be null');
        System.assertEquals(1, retrievedGame.players.size(), 'Should have 1 player (organizer)');
    }

    @isTest
    static void testErrorHandlingInvalidId() {
        Test.startTest();
        try {
            PadelGameController.getGameById(null); // Null ID
            System.assert(false, 'Should have thrown exception');
        } catch (Exception e) {
            System.assert(e instanceof AuraHandledException, 'Should throw AuraHandledException');
        }
        Test.stopTest();
    }
}
