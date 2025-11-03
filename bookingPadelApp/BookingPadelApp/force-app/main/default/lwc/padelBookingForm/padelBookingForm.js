import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getCourts from '@salesforce/apex/PadelGameController.getCourts';
import createCourt from '@salesforce/apex/PadelGameController.createCourt';
import getPlayers from '@salesforce/apex/PadelGameController.getPlayers';
import createPlayer from '@salesforce/apex/PadelGameController.createPlayer';
import createGame from '@salesforce/apex/PadelGameController.createGame';

export default class PadelBookingForm extends LightningElement {
    @track isLoading = false;
    @track showCourtModal = false;
    @track showOrganizerModal = false;

    // Form fields
    gameDate = '';
    gameTime = '';
    totalPrice = '';
    duration = '';
    maxPlayers = 4;
    notes = '';

    // Selected IDs
    selectedCourtId = null;
    selectedOrganizerId = null;

    // Combobox options
    courtOptions = [];
    organizerOptions = [];

    // Create court modal fields
    newCourtName = '';
    newCourtNumber = '';
    newCourtLocation = '';

    // Create organizer modal field
    newOrganizerName = '';

    /**
     * Load courts when component initializes
     */
    connectedCallback() {
        this.loadCourts();
        this.loadOrganizers();
    }

    /**
     * Load courts from Apex
     */
    loadCourts() {
        getCourts({ searchTerm: '' })
            .then(data => {
                this.courtOptions = data.map(c => ({
                    label: c.courtNumber
                        ? `${c.courtName} (Kort ${c.courtNumber})`
                        : c.courtName,
                    value: c.courtId
                }));
            })
            .catch(error => {
                console.error('Error loading courts:', error);
                this.courtOptions = [];
            });
    }

    /**
     * Load organizers (players) from Apex
     */
    loadOrganizers() {
        getPlayers({ searchTerm: '' })
            .then(data => {
                this.organizerOptions = data.map(p => ({
                    label: p.playerName,
                    value: p.playerId
                }));
            })
            .catch(error => {
                console.error('Error loading organizers:', error);
                this.organizerOptions = [];
            });
    }

    /**
     * Handle court search
     */
    handleCourtSearch(event) {
        const searchTerm = event.target.value;

        getCourts({ searchTerm: searchTerm || '' })
            .then(data => {
                this.courtOptions = data.map(c => ({
                    label: c.courtNumber
                        ? `${c.courtName} (Kort ${c.courtNumber})`
                        : c.courtName,
                    value: c.courtId
                }));
            })
            .catch(error => {
                console.error('Error searching courts:', error);
                this.courtOptions = [];
            });
    }

    /**
     * Handle organizer search
     */
    handleOrganizerSearch(event) {
        const searchTerm = event.target.value;

        getPlayers({ searchTerm: searchTerm || '' })
            .then(data => {
                this.organizerOptions = data.map(p => ({
                    label: p.playerName,
                    value: p.playerId
                }));
            })
            .catch(error => {
                console.error('Error searching organizers:', error);
                this.organizerOptions = [];
            });
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
        return this.isLoading || !this.gameDate || !this.gameTime ||
               !this.selectedCourtId || !this.selectedOrganizerId || !this.totalPrice;
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
            case 'price':
                this.totalPrice = value;
                break;
            case 'duration':
                this.duration = value;
                break;
            case 'maxPlayers':
                this.maxPlayers = value;
                break;
            case 'notes':
                this.notes = value;
                break;
            default:
                break;
        }
    }

    /**
     * Handle court selection
     */
    handleCourtSelect(event) {
        this.selectedCourtId = event.detail.value;
    }

    /**
     * Handle organizer selection
     */
    handleOrganizerSelect(event) {
        this.selectedOrganizerId = event.detail.value;
    }

    /**
     * Open create court modal
     */
    handleAddCourtClick() {
        this.showCourtModal = true;
    }

    /**
     * Close create court modal
     */
    handleCancelCourtModal() {
        this.showCourtModal = false;
        this.newCourtName = '';
        this.newCourtNumber = '';
        this.newCourtLocation = '';
    }

    /**
     * Handle court modal input changes
     */
    handleCourtModalInputChange(event) {
        const field = event.target.dataset.field;
        const value = event.target.value;

        switch(field) {
            case 'courtName':
                this.newCourtName = value;
                break;
            case 'courtNumber':
                this.newCourtNumber = value;
                break;
            case 'courtLocation':
                this.newCourtLocation = value;
                break;
            default:
                break;
        }
    }

    /**
     * Create new court
     */
    async handleSubmitCourt() {
        if (!this.newCourtName || this.newCourtName.trim() === '') {
            this.showToast('Błąd', 'Nazwa kortu jest wymagana', 'error');
            return;
        }

        this.isLoading = true;

        try {
            const courtId = await createCourt({
                courtName: this.newCourtName.trim(),
                courtNumber: this.newCourtNumber ? parseInt(this.newCourtNumber, 10) : null,
                location: this.newCourtLocation ? this.newCourtLocation.trim() : null
            });

            this.showToast('Sukces', 'Kort został utworzony', 'success');

            // Select the newly created court
            this.selectedCourtId = courtId;

            // Reload courts list
            await this.loadCourts();

            // Close modal
            this.handleCancelCourtModal();
        } catch (error) {
            console.error('Error creating court:', error);
            const errorMessage = error.body?.message || error.message || 'Nie udało się utworzyć kortu';
            this.showToast('Błąd', errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Open create organizer modal
     */
    handleAddOrganizerClick() {
        this.showOrganizerModal = true;
    }

    /**
     * Close create organizer modal
     */
    handleCancelOrganizerModal() {
        this.showOrganizerModal = false;
        this.newOrganizerName = '';
    }

    /**
     * Handle organizer name input change
     */
    handleOrganizerNameChange(event) {
        this.newOrganizerName = event.target.value;
    }

    /**
     * Create new organizer (player)
     */
    async handleSubmitOrganizer() {
        if (!this.newOrganizerName || this.newOrganizerName.trim() === '') {
            this.showToast('Błąd', 'Imię organizatora jest wymagane', 'error');
            return;
        }

        this.isLoading = true;

        try {
            const playerId = await createPlayer({
                playerName: this.newOrganizerName.trim()
            });

            this.showToast('Sukces', 'Organizator został utworzony', 'success');

            // Select the newly created organizer
            this.selectedOrganizerId = playerId;

            // Reload organizers list
            await this.loadOrganizers();

            // Close modal
            this.handleCancelOrganizerModal();
        } catch (error) {
            console.error('Error creating organizer:', error);
            const errorMessage = error.body?.message || error.message || 'Nie udało się utworzyć organizatora';
            this.showToast('Błąd', errorMessage, 'error');
        } finally {
            this.isLoading = false;
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

        if (!this.selectedCourtId) {
            this.showToast('Błąd', 'Kort jest wymagany', 'error');
            return false;
        }

        if (!this.selectedOrganizerId) {
            this.showToast('Błąd', 'Organizator jest wymagany', 'error');
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

        // Validate duration
        const duration = parseFloat(this.duration);
        if (isNaN(duration) || duration <= 0) {
            this.showToast('Błąd', 'Czas trwania jest wymagany i musi być większy niż 0', 'error');
            return false;
        }

        // Validate max players
        const maxPlayers = parseInt(this.maxPlayers, 10);
        if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 8) {
            this.showToast('Błąd', 'Maksymalna liczba graczy musi być między 2 a 8', 'error');
            return false;
        }

        return true;
    }

    /**
     * Handle form submission
     * After successful game creation, dispatches event to trigger parent refresh
     */
    async handleSubmit() {
        if (!this.validateForm()) {
            return;
        }

        this.isLoading = true;

        try {
            const gameId = await createGame({
                courtId: this.selectedCourtId,
                organizerPlayerId: this.selectedOrganizerId,
                gameDate: this.gameDate,
                gameTime: this.gameTime,
                totalPrice: parseFloat(this.totalPrice),
                duration: parseFloat(this.duration),
                maxPlayers: parseInt(this.maxPlayers, 10),
                notes: this.notes ? this.notes.trim() : null
            });

            this.showToast('Sukces', 'Gra została utworzona pomyślnie!', 'success');

            // Reset form first
            this.resetForm();

            // Dispatch event to parent component to trigger refresh and switch tabs
            // This will trigger refreshApex() in padelBookingList via padelBookingApp
            this.dispatchEvent(new CustomEvent('gamecreated', {
                detail: {
                    gameId: gameId
                },
                bubbles: true,
                composed: true
            }));

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
        this.selectedCourtId = null;
        this.selectedOrganizerId = null;
        this.totalPrice = '';
        this.duration = '';
        this.maxPlayers = 4;
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
