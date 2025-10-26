import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import addPlayerToGame from '@salesforce/apex/PadelGameController.addPlayerToGame';

export default class PadelGameCard extends LightningElement {
    @api game;
    @track showJoinModal = false;
    @track isLoading = false;

    playerName = '';
    playerEmail = '';
    playerPhone = '';

    /**
     * Computed property to determine if the game is full
     */
    get isFull() {
        return this.game && this.game.Current_Players__c >= this.game.Max_Players__c;
    }

    /**
     * Computed property to determine if the game is cancelled
     */
    get isCancelled() {
        return this.game && this.game.Status__c === 'Anulowana';
    }

    /**
     * Computed property to check if join button should be disabled
     */
    get isJoinDisabled() {
        return this.isFull || this.isCancelled;
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
     * Computed property to get formatted date
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
     * Computed property to get formatted time
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
     * Computed property to get player count display
     */
    get playerCountDisplay() {
        if (!this.game) return '0/0';
        return `${this.game.Current_Players__c || 0}/${this.game.Max_Players__c || 4}`;
    }

    /**
     * Computed property to get price per person
     */
    get pricePerPerson() {
        if (!this.game || !this.game.Price_Per_Person__c) return '0';
        return this.game.Price_Per_Person__c.toFixed(2);
    }

    /**
     * Computed property to check if there are players
     */
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
     * Open join modal
     */
    handleJoinClick() {
        this.showJoinModal = true;
    }

    /**
     * Close join modal
     */
    handleCancelJoin() {
        this.showJoinModal = false;
        this.resetForm();
    }

    /**
     * Handle input changes
     */
    handleInputChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;

        switch(field) {
            case 'name':
                this.playerName = value;
                break;
            case 'email':
                this.playerEmail = value;
                break;
            case 'phone':
                this.playerPhone = value;
                break;
            default:
                break;
        }
    }

    /**
     * Validate form inputs
     */
    validateForm() {
        // Check required fields
        if (!this.playerName || this.playerName.trim() === '') {
            this.showToast('Błąd', 'Imię i nazwisko jest wymagane', 'error');
            return false;
        }

        // Validate email if provided
        if (this.playerEmail && this.playerEmail.trim() !== '') {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(this.playerEmail)) {
                this.showToast('Błąd', 'Nieprawidłowy format adresu email', 'error');
                return false;
            }
        }

        // Validate phone if provided
        if (this.playerPhone && this.playerPhone.trim() !== '') {
            const phonePattern = /^[\d\s\-+()]{9,}$/;
            if (!phonePattern.test(this.playerPhone)) {
                this.showToast('Błąd', 'Nieprawidłowy format numeru telefonu', 'error');
                return false;
            }
        }

        return true;
    }

    /**
     * Handle join game submission
     */
    async handleSubmitJoin() {
        if (!this.validateForm()) {
            return;
        }

        this.isLoading = true;

        try {
            const playerData = JSON.stringify({
                Player_Name__c: this.playerName.trim(),
                Email__c: this.playerEmail ? this.playerEmail.trim() : null,
                Phone__c: this.playerPhone ? this.playerPhone.trim() : null
            });

            const playerId = await addPlayerToGame({
                gameId: this.game.Id,
                playerData: playerData
            });

            this.showToast('Sukces', 'Zostałeś dodany do gry!', 'success');

            // Dispatch event to parent component
            this.dispatchEvent(new CustomEvent('playeradded', {
                detail: {
                    gameId: this.game.Id,
                    playerId: playerId
                }
            }));

            this.handleCancelJoin();
        } catch (error) {
            console.error('Error adding player to game:', error);
            const errorMessage = error.body?.message || error.message || 'Nie udało się dodać gracza do gry';
            this.showToast('Błąd', errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Reset form fields
     */
    resetForm() {
        this.playerName = '';
        this.playerEmail = '';
        this.playerPhone = '';
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
