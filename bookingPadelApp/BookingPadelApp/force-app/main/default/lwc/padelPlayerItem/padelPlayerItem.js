import { LightningElement, api } from 'lwc';

export default class PadelPlayerItem extends LightningElement {
    @api player;
    @api showActions = false;

    /**
     * Computed property to check if player has paid
     */
    get isPaid() {
        return this.player && this.player.Payment_Status__c === 'Zapłacone';
    }

    /**
     * Computed property for payment status icon name
     */
    get paymentIconName() {
        return this.isPaid ? 'utility:check' : 'utility:close';
    }

    /**
     * Computed property for payment status icon variant
     */
    get paymentIconVariant() {
        return this.isPaid ? 'success' : 'error';
    }

    /**
     * Computed property for payment status text
     */
    get paymentStatusText() {
        return this.isPaid ? 'Zapłacone' : 'Niezapłacone';
    }

    /**
     * Computed property for payment status CSS class
     */
    get paymentStatusClass() {
        return this.isPaid
            ? 'slds-text-color_success'
            : 'slds-text-color_error';
    }

    /**
     * Computed property to check if email exists
     */
    get hasEmail() {
        return this.player && this.player.Email__c;
    }

    /**
     * Computed property to check if phone exists
     */
    get hasPhone() {
        return this.player && this.player.Phone__c;
    }

    /**
     * Computed property for player display name
     */
    get playerName() {
        return this.player ? this.player.Player_Name__c : '';
    }

    /**
     * Computed property for player email
     */
    get playerEmail() {
        return this.player ? this.player.Email__c : '';
    }

    /**
     * Computed property for player phone
     */
    get playerPhone() {
        return this.player ? this.player.Phone__c : '';
    }

    /**
     * Handle remove player action
     */
    handleRemovePlayer() {
        if (!this.player) return;

        // Dispatch event to parent component
        this.dispatchEvent(new CustomEvent('removeplayer', {
            detail: {
                playerId: this.player.Id,
                playerName: this.player.Player_Name__c
            },
            bubbles: true,
            composed: true
        }));
    }

    /**
     * Handle payment status toggle
     */
    handlePaymentToggle() {
        if (!this.player) return;

        const newStatus = this.isPaid ? 'Niezapłacone' : 'Zapłacone';

        // Dispatch event to parent component
        this.dispatchEvent(new CustomEvent('paymentstatuschange', {
            detail: {
                playerId: this.player.Id,
                newStatus: newStatus
            },
            bubbles: true,
            composed: true
        }));
    }
}
