import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import updatePaymentStatus from '@salesforce/apex/PadelGameController.updatePaymentStatus';
import removePlayerFromGame from '@salesforce/apex/PadelGameController.removePlayerFromGame';

export default class PadelPlayerItem extends LightningElement {
    @api player;
    @api showActions = false;

    @track showOrganizerModal = false;
    @track autoTransferOrganizer = false;
    @track isLoading = false;

    /**
     * Computed property to check if player is organizer
     */
    get isOrganizer() {
        return this.player && this.player.isOrganizer === true;
    }

    /**
     * Computed property to check if player has paid
     */
    get isPaid() {
        return this.player && this.player.paymentStatus === 'Zapłacone';
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
     * Computed property for player display name
     */
    get playerName() {
        return this.player ? this.player.playerName : '';
    }

    /**
     * Handle payment status toggle
     * After successful DML operation, dispatches event to trigger parent refresh
     */
    async handlePaymentToggle() {
        if (!this.player || !this.player.registrationId) return;

        const newStatus = this.isPaid ? 'Niezapłacone' : 'Zapłacone';
        this.isLoading = true;

        try {
            await updatePaymentStatus({
                registrationId: this.player.registrationId,
                paymentStatus: newStatus
            });

            this.showToast('Sukces', 'Status płatności został zaktualizowany', 'success');

            // Dispatch event to parent to refresh game list
            // This will trigger refreshApex() in padelBookingList
            this.dispatchEvent(new CustomEvent('playeradded', {
                bubbles: true,
                composed: true
            }));

        } catch (error) {
            console.error('Error updating payment status:', error);
            const errorMessage = error.body?.message || error.message || 'Nie udało się zaktualizować statusu płatności';
            this.showToast('Błąd', errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle remove player action
     */
    handleRemovePlayer() {
        if (!this.player) return;

        // If player is organizer, show modal with transfer option
        if (this.isOrganizer) {
            this.showOrganizerModal = true;
        } else {
            // Directly remove non-organizer player
            this.confirmRemovePlayer(false);
        }
    }

    /**
     * Close organizer removal modal
     */
    handleCancelOrganizerModal() {
        this.showOrganizerModal = false;
        this.autoTransferOrganizer = false;
    }

    /**
     * Handle auto-transfer checkbox change
     */
    handleAutoTransferChange(event) {
        this.autoTransferOrganizer = event.target.checked;
    }

    /**
     * Confirm organizer removal
     */
    handleConfirmOrganizerRemoval() {
        this.confirmRemovePlayer(this.autoTransferOrganizer);
        this.handleCancelOrganizerModal();
    }

    /**
     * Confirm and execute player removal
     * After successful DML operation, dispatches event to trigger parent refresh
     */
    async confirmRemovePlayer(autoTransfer) {
        if (!this.player || !this.player.registrationId) return;

        this.isLoading = true;

        try {
            await removePlayerFromGame({
                registrationId: this.player.registrationId,
                autoTransferOrganizer: autoTransfer
            });

            this.showToast('Sukces', 'Gracz został usunięty', 'success');

            // Dispatch event to parent to refresh game list
            // This will trigger refreshApex() in padelBookingList
            this.dispatchEvent(new CustomEvent('playeradded', {
                bubbles: true,
                composed: true
            }));

        } catch (error) {
            console.error('Error removing player:', error);
            const errorMessage = error.body?.message || error.message || 'Nie udało się usunąć gracza';
            this.showToast('Błąd', errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Show toast notification
     */
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        }));
    }
}
