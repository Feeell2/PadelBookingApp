/**
 * Test for [CLASS_NAME]
 */
@isTest
private class [CLASS_NAME]Test {
    
    @TestSetup
    static void setup() {
        // Create 200 test records
        List<[SOBJECT]> records = new List<[SOBJECT]>();
        for (Integer i = 0; i < 200; i++) {
            records.add(new [SOBJECT](
                Name = 'Test ' + i
                // Add fields
            ));
        }
        insert records;
    }
    
    @isTest
    static void test[METHOD]_Success() {
        // Given
        List<[SOBJECT]> records = [SELECT Id FROM [SOBJECT] LIMIT 200];
        
        // When
        Test.startTest();
        [RETURN_TYPE] result = [CLASS_NAME].[METHOD]([PARAMS]);
        Test.stopTest();
        
        // Then
        Assert.areEqual([EXPECTED], result, 'Should return correct value');
    }
    
    @isTest
    static void test[METHOD]_BulkOperation() {
        // Given - 200 records from setup
        
        // When
        Test.startTest();
        // Call method with 200 records
        Test.stopTest();
        
        // Then
        Assert.isTrue(Limits.getQueries() < 100, 'Should not exceed query limits');
    }
    
    @isTest
    static void test[METHOD]_NullInput() {
        // When/Then
        try {
            [CLASS_NAME].[METHOD](null);
            Assert.fail('Should throw exception');
        } catch (IllegalArgumentException e) {
            Assert.isTrue(e.getMessage().contains('required'));
        }
    }
}