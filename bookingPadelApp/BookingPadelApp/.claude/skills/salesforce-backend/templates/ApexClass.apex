/**
 * [CLASS_DESCRIPTION]
 */
public with sharing class [CLASS_NAME] {
    
    /**
     * [METHOD_DESCRIPTION]
     */
    @AuraEnabled
    public static List<[SOBJECT]> get[SOBJECTS]([PARAMS]) {
        // Validate
        if ([PARAM] == null) {
            throw new IllegalArgumentException('Param required');
        }
        
        // Query
        return [
            SELECT Id, Name, [FIELDS]
            FROM [SOBJECT]
            WHERE [CONDITION]
            WITH SECURITY_ENFORCED
            LIMIT 50
        ];
    }
    
    /**
     * [METHOD_DESCRIPTION]
     */
    @AuraEnabled
    public static void update[SOBJECTS](List<[SOBJECT]> records) {
        // Security check
        if (records == null || records.isEmpty()) {
            throw new IllegalArgumentException('Records required');
        }
        
        // Process
        for ([SOBJECT] record : records) {
            // Business logic
        }
        
        // DML
        try {
            update records;
        } catch (DmlException e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}