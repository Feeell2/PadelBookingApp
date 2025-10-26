import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getGameById from '@salesforce/apex/PadelGameController.getGameById';
import updatePlayerPaymentStatus from '@salesforce/apex/PadelGameController.updatePlayerPaymentStatus';
import removePlayerFromGame from '@salesforce/apex/PadelGameController.removePlayerFromGame';
import deleteGame from '@salesforce/apex/PadelGameController.deleteGame';

export default class PadelCreatedGameItem extends LightningElement {
    @api gameId;
    @track showDeleteModal = false;
    @track isLoading = false;

    wiredGameResult;
    game;
    error;

    /**
     * Wire Apex method to get game by ID
     */
    @wire(getGameById, { gameId: '$gameId' })
    wiredGame(result) {
        this.wiredGameResult = result;
        if (result.data) {
            this.game = result.data;
            this.error = undefined;
        } else if (result.error) {
            this.error = result.error;
            this.game = undefined;
            console.error('Error loading game:', result.error);
        }
    }

    /**
     * Computed property to check if game data is loaded
     */
    get hasGameData() {
        return this.game != null;
    }

    /**
     * Computed property for formatted date
     */
    get formattedDate() {
        if (!this.game || !this.game.Game_Date__c) return '';
        const date = new Date(this.game.Game_Date__c);
        return date.toLocaleDateString('pl-PL', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Computed property for formatted time
     */
    get formattedTime() {
  if (!this.game || !this.game.Game_Time__c) return '';

        // Handle if time is in milliseconds (number)
        if (typeof this.game.Game_Time__c === 'number') {
            const totalMinutes = Math.floor(this.game.Game_Time__c / 60000);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }

        // Handle if time is a string (HH:MM:SS format)
        return this.game.Game_Time__c.substring(0, 5);
    }

    /**
     * Computed property for player count display
     */
    get playerCountDisplay() {
        if (!this.game) return '0/0';
        return `${this.game.Current_Players__c || 0}/${this.game.Max_Players__c || 4}`;
    }

    /**
     * Computed property for price per person
     */
    get pricePerPerson() {
        if (!this.game || !this.game.Price_Per_Person__c) return '0';
        return this.game.Price_Per_Person__c.toFixed(2);
    }

    /**
     * Computed property to check if there are players
     */
    /**
     * Computed property for current player count
     */
    /**
     * Computed property to enable actions in player items
     */
    get showPlayerActions() {
        return true;
    }


    get currentPlayerCount() {
        return this.game && this.game.Current_Players__c ? this.game.Current_Players__c : 0;
    }


    get hasPlayers() {
        return this.game && this.game.Padel_Players__r && this.game.Padel_Players__r.length > 0;
    }

    /**
     * Computed property to get players list
     */
    get players() {
        return this.game && this.game.Padel_Players__r ? this.game.Padel_Players__r : [];
    }

    /**
     * Computed property for share link
     */
    get shareLink() {
        if (!this.game || !this.game.Share_Link__c) {
            // Generate a share link based on current URL and game ID
            const baseUrl = window.location.origin + window.location.pathname;
            return `${baseUrl}?gameId=${this.gameId}`;
        }
        return this.game.Share_Link__c;
    }

    /**
     * Computed property for status badge variant
     */
    get statusVariant() {
        if (!this.game) return 'warning';

        switch (this.game.Status__c) {
            case 'Dostępna':
                return 'success';
            case 'Zarezerwowana':
                return 'warning';
            case 'Pełna':
                return 'error';
            case 'Anulowana':
                return 'inverse';
            default:
                return 'warning';
        }
    }

    /**
     * Handle payment status change
     */
    async handlePaymentStatusChange(event) {
        const playerId = event.detail.playerId;
        const newStatus = event.detail.newStatus;

        this.isLoading = true;

        try {
            await updatePlayerPaymentStatus({
                playerId: playerId,
                status: newStatus
            });

            this.showToast('Sukces', 'Status płatności został zaktualizowany', 'success');

            // Refresh game data
            await refreshApex(this.wiredGameResult);
        } catch (error) {
            console.error('Error updating payment status:', error);
            const errorMessage = error.body?.message || error.message || 'Nie udało się zaktualizować statusu płatności';
            this.showToast('Błąd', errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle remove player
     */
    async handleRemovePlayer(event) {
        const playerId = event.detail.playerId;
        const playerName = event.detail.playerName;

        // Confirm removal
        const confirmed = confirm(`Czy na pewno chcesz usunąć gracza ${playerName}?`);
        if (!confirmed) return;

        this.isLoading = true;

        try {
            await removePlayerFromGame({
                playerId: playerId
            });

            this.showToast('Sukces', `Gracz ${playerName} został usunięty`, 'success');

            // Refresh game data
            await refreshApex(this.wiredGameResult);
        } catch (error) {
            console.error('Error removing player:', error);
            const errorMessage = error.body?.message || error.message || 'Nie udało się usunąć gracza';
            this.showToast('Błąd', errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle copy share link
     */
    handleCopyLink() {
        const link = this.shareLink;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link)
                .then(() => {
                    this.showToast('Sukces', 'Link został skopiowany do schowka', 'success');
                })
                .catch(error => {
                    console.error('Error copying to clipboard:', error);
                    this.fallbackCopyToClipboard(link);
                });
        } else {
            this.fallbackCopyToClipboard(link);
        }
    }

    /**
     * Fallback method for copying to clipboard
     */
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            this.showToast('Sukces', 'Link został skopiowany do schowka', 'success');
        } catch (error) {
            console.error('Fallback: Unable to copy:', error);
            this.showToast('Błąd', 'Nie udało się skopiować linku', 'error');
        }

        document.body.removeChild(textArea);
    }

    /**
     * Show delete confirmation modal
     */
    handleShowDeleteModal() {
        this.showDeleteModal = true;
    }

    /**
     * Hide delete confirmation modal
     */
    handleCancelDelete() {
        this.showDeleteModal = false;
    }

    /**
     * Handle delete game
     */
    async handleConfirmDelete() {
        this.isLoading = true;
        this.showDeleteModal = false;

        try {
            await deleteGame({
                gameId: this.gameId
            });

            this.showToast('Sukces', 'Gra została usunięta', 'success');

            // Dispatch event to parent component
            this.dispatchEvent(new CustomEvent('gamedeleted', {
                detail: {
                    gameId: this.gameId
                }
            }));
        } catch (error) {
            console.error('Error deleting game:', error);
            const errorMessage = error.body?.message || error.message || 'Nie udało się usunąć gry';
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
