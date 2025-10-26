import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import createGame from '@salesforce/apex/PadelGameController.createGame';

export default class PadelBookingForm extends LightningElement {
    @track isLoading = false;

    gameDate = '';
    gameTime = '';
    courtName = '';
    totalPrice = '';
    maxPlayers = 4;
    creatorEmail = '';
    notes = '';

    /**
     * Court name options for combobox
     */
    get courtOptions() {
        return [
            { label: 'Kort 1', value: 'Kort 1' },
            { label: 'Kort 2', value: 'Kort 2' },
            { label: 'Kort 3', value: 'Kort 3' },
            { label: 'Kort 4', value: 'Kort 4' }
        ];
    }

    /**
     * Get today's date in YYYY-MM-DD format for min date validation
     */
    get minDate() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    }

    /**
     * Check if submit button should be disabled
     */
    get isSubmitDisabled() {
        return this.isLoading || !this.gameDate || !this.gameTime || !this.courtName || !this.totalPrice;
    }

    /**
     * Computed property for price per person preview
     */
    get pricePerPerson() {
        if (!this.totalPrice || !this.maxPlayers) return '0.00';
        const price = parseFloat(this.totalPrice);
        const players = parseInt(this.maxPlayers, 10);
        if (isNaN(price) || isNaN(players) || players === 0) return '0.00';
        return (price / players).toFixed(2);
    }

    /**
     * Handle input changes
     */
    handleInputChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;

        switch(field) {
            case 'date':
                this.gameDate = value;
                break;
            case 'time':
                this.gameTime = value;
                break;
            case 'court':
                this.courtName = value;
                break;
            case 'price':
                this.totalPrice = value;
                break;
            case 'maxPlayers':
                this.maxPlayers = value;
                break;
            case 'email':
                this.creatorEmail = value;
                break;
            case 'notes':
                this.notes = value;
                break;
            default:
                break;
        }
    }

    /**
     * Validate form before submission
     */
    validateForm() {
        // Check required fields
        if (!this.gameDate) {
            this.showToast('Błąd', 'Data gry jest wymagana', 'error');
            return false;
        }

        if (!this.gameTime) {
            this.showToast('Błąd', 'Godzina gry jest wymagana', 'error');
            return false;
        }

        if (!this.courtName) {
            this.showToast('Błąd', 'Kort jest wymagany', 'error');
            return false;
        }

        if (!this.totalPrice) {
            this.showToast('Błąd', 'Cena całkowita jest wymagana', 'error');
            return false;
        }

        // Validate date is not in the past
        const selectedDate = new Date(this.gameDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            this.showToast('Błąd', 'Data gry nie może być w przeszłości', 'error');
            return false;
        }

        // Validate price
        const price = parseFloat(this.totalPrice);
        if (isNaN(price) || price <= 0) {
            this.showToast('Błąd', 'Cena musi być większa niż 0', 'error');
            return false;
        }

        // Validate max players
        const maxPlayers = parseInt(this.maxPlayers, 10);
        if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 8) {
            this.showToast('Błąd', 'Maksymalna liczba graczy musi być między 2 a 8', 'error');
            return false;
        }

        // Validate email if provided
        if (this.creatorEmail && this.creatorEmail.trim() !== '') {
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(this.creatorEmail)) {
                this.showToast('Błąd', 'Nieprawidłowy format adresu email', 'error');
                return false;
            }
        }

        return true;
    }

    /**
     * Handle form submission
     */
    async handleSubmit() {
        if (!this.validateForm()) {
            return;
        }

        this.isLoading = true;

        try {
            // Prepare game data object
            const gameData = {
                Game_Date__c: this.gameDate,
                Game_Time__c: this.gameTime,
                Court_Name__c: this.courtName,
                Total_Price__c: parseFloat(this.totalPrice),
                Max_Players__c: parseInt(this.maxPlayers, 10),
                Status__c: 'Dostępna',
                Current_Players__c: 0
            };

            // Add optional fields if provided
            if (this.creatorEmail && this.creatorEmail.trim() !== '') {
                gameData.Creator_Email__c = this.creatorEmail.trim();
            }

            if (this.notes && this.notes.trim() !== '') {
                gameData.Notes__c = this.notes.trim();
            }
            console.log(gameData);
            
            // Call Apex method
            const gameId = await createGame({
                gameData: JSON.stringify(gameData)
            });
            console.log(gameId);
            this.showToast('Sukces', 'Gra została utworzona pomyślnie!', 'success');

            // Dispatch event to parent component
            this.dispatchEvent(new CustomEvent('gamecreated', {
                detail: {
                    gameId: gameId
                }
            }));

            // Reset form
            this.resetForm();
        } catch (error) {
            console.error('Error creating game:', error);
            const errorMessage = error.body?.message || error.message || 'Nie udało się utworzyć gry';
            this.showToast('Błąd', errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Handle cancel button click
     */
    handleCancel() {
        this.resetForm();

        // Dispatch cancel event to parent component
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    /**
     * Reset form to initial state
     */
    resetForm() {
        this.gameDate = '';
        this.gameTime = '';
        this.courtName = '';
        this.totalPrice = '';
        this.maxPlayers = 4;
        this.creatorEmail = '';
        this.notes = '';

        // Reset input field validity
        const inputs = this.template.querySelectorAll('lightning-input, lightning-combobox, lightning-textarea');
        if (inputs) {
            inputs.forEach(input => {
                if (input.reportValidity) {
                    input.setCustomValidity('');
                    input.reportValidity();
                }
            });
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
