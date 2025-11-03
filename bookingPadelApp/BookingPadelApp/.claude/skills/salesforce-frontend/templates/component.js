import { LightningElement, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';

// Import Apex methods
import getRecords from '@salesforce/apex/[CONTROLLER].[METHOD]';
import updateRecord from '@salesforce/apex/[CONTROLLER].[METHOD]';

const COLUMNS = [
    { label: '[LABEL]', fieldName: '[FIELD]', type: 'text' },
    { label: '[LABEL]', fieldName: '[FIELD]', type: 'currency' },
    { 
        type: 'action',
        typeAttributes: { rowActions: [
            { label: 'Edit', name: 'edit' },
            { label: 'Delete', name: 'delete' }
        ]}
    }
];

export default class [COMPONENT_NAME] extends LightningElement {
    
    // Public properties (from parent)
    @api recordId;
    
    // Tracked properties
    @track records = [];
    @track error;
    
    // Private properties
    columns = COLUMNS;
    searchTerm = '';
    isLoading = false;
    wiredRecordsResult;

    // Wire service - automatic data fetching
    @wire(getRecords, { recordId: '$recordId', searchTerm: '$searchTerm' })
    wiredRecords(result) {
        this.wiredRecordsResult = result;
        
        if (result.data) {
            this.records = result.data;
            this.error = undefined;
        } else if (result.error) {
            this.error = result.error.body?.message || 'Unknown error';
            this.records = [];
        }
    }

    // Computed properties
    get hasRecords() {
        return this.records && this.records.length > 0;
    }

    // Event handlers
    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    handleRefresh() {
        return refreshApex(this.wiredRecordsResult);
    }

    handleRowAction(event) {
        const action = event.detail.action;
        const row = event.detail.row;

        switch (action.name) {
            case 'edit':
                this.handleEdit(row);
                break;
            case 'delete':
                this.handleDelete(row);
                break;
        }
    }

    handleEdit(row) {
        // Navigation or modal logic
        console.log('Edit', row.id);
    }

    handleDelete(row) {
        this.isLoading = true;

        updateRecord({ recordId: row.id })
            .then(() => {
                this.showToast('Success', 'Record deleted', 'success');
                return this.handleRefresh();
            })
            .catch(error => {
                this.showToast('Error', error.body?.message, 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    // Utility methods
    showToast(title, message, variant = 'info') {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        }));
    }
}