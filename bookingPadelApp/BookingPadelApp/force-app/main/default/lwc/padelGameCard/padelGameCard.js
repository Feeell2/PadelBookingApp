import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getPlayers from '@salesforce/apex/PadelGameController.getPlayers';
import createPlayer from '@salesforce/apex/PadelGameController.createPlayer';
import addPlayerToGame from '@salesforce/apex/PadelGameController.addPlayerToGame';
import deleteGame from '@salesforce/apex/PadelGameController.deleteGame';
import updateGame from '@salesforce/apex/PadelGameController.updateGame';

export default class PadelGameCard extends LightningElement {
    @api game;
    @track showJoinModal = false;
    @track showCreatePlayerModal = false;
    @track showDeleteModal = false;
    @track showEditModal = false;
    @track isLoading = false;

    selectedPlayerId = null;
    searchTerm = '';
    playerOptions = [];

    // Create player modal fields
    newPlayerName = '';

    // Edit game modal fields
    editGameDate = null;
    editGameTime = null;
    editTotalPrice = null;
    editDuration = null;
    editNotes = null;
    editMaxPlayers = null;

    /**
     * Wire service to fetch players based on search term
     */
    handlePlayerSearch(event) {
        this.searchTerm = event.target.value;

        if (this.searchTerm && this.searchTerm.length >= 2) {
            getPlayers({ searchTerm: this.searchTerm, gameId: this.game.gameId })
                .then(data => {
                    // Get IDs of already registered players
                    const registeredPlayerIds = new Set(
                        this.game.players ? this.game.players.map(p => p.playerId) : []
                    );

                    // Filter out already registered players
                    const availablePlayers = data.filter(p => !registeredPlayerIds.has(p.playerId));

                    this.playerOptions = availablePlayers.map(p => ({
                        label: p.playerName,
                        value: p.playerId
                    }));
                })
                .catch(error => {
                    console.error('Error fetching players:', error);
                    this.playerOptions = [];
                });
        } else {
            // Load all players if search is empty
            getPlayers({ searchTerm: '', gameId: this.game.gameId })
                .then(data => {
                    // Get IDs of already registered players
                    const registeredPlayerIds = new Set(
                        this.game.players ? this.game.players.map(p => p.playerId) : []
                    );

                    // Filter out already registered players
                    const availablePlayers = data.filter(p => !registeredPlayerIds.has(p.playerId));

                    this.playerOptions = availablePlayers.map(p => ({
                        label: p.playerName,
                        value: p.playerId
                    }));
                })
                .catch(error => {
                    console.error('Error fetching players:', error);
                    this.playerOptions = [];
                });
        }
    }

    /**
     * Load initial player list when join modal opens
     */
    loadPlayers() {
        getPlayers({ searchTerm: '', gameId: this.game.gameId })
            .then(data => {
                // Get IDs of already registered players
                const registeredPlayerIds = new Set(
                    this.game.players ? this.game.players.map(p => p.playerId) : []
                );

                // Filter out already registered players
                const availablePlayers = data.filter(p => !registeredPlayerIds.has(p.playerId));

                this.playerOptions = availablePlayers.map(p => ({
                    label: p.playerName,
                    value: p.playerId
                }));
            })
            .catch(error => {
                console.error('Error loading players:', error);
                this.playerOptions = [];
            });
    }

    /**
     * Computed property to determine if the game is full
     */
    get isFull() {
        return this.game && this.game.currentPlayers >= this.game.maxPlayers;
    }

    /**
     * Computed property to determine if the game is cancelled
     */
    get isCancelled() {
        return this.game && this.game.status === 'Anulowana';
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

        switch (this.game.status) {
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
        if (!this.game || !this.game.gameDate) return '';

        try {
            // Salesforce Date comes as ISO string (YYYY-MM-DD)
            // Parse it as local date to avoid timezone issues
            const dateParts = this.game.gameDate.split('-');
            if (dateParts.length !== 3) {
                console.error('Invalid date format:', this.game.gameDate);
                return this.game.gameDate; // Return raw value if format is unexpected
            }

            const year = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
            const day = parseInt(dateParts[2], 10);

            // Validate parsed values
            if (isNaN(year) || isNaN(month) || isNaN(day)) {
                console.error('Invalid date values:', { year, month, day });
                return this.game.gameDate;
            }

            const date = new Date(year, month, day);

            // Check if date is valid
            if (isNaN(date.getTime())) {
                console.error('Invalid date object:', date);
                return this.game.gameDate;
            }

            return date.toLocaleDateString('pl-PL', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting date:', error, this.game.gameDate);
            return this.game.gameDate || '';
        }
    }

    /**
     * Computed property to get formatted time
     */
    get formattedTime() {
        if (!this.game || this.game.gameTime == null) return '';

        try {
            return this.convertMillisecondsToTime(this.game.gameTime);
        } catch (error) {
            console.error('Error formatting time:', error, this.game.gameTime);
            return this.game.gameTime || '';
        }
    }

    /**
     * Helper method to convert Salesforce Time (milliseconds from midnight) to HH:mm format
     * @param {number} milliseconds - Time in milliseconds from midnight
     * @returns {string} Formatted time as "HH:mm" (e.g., "14:30", "09:00")
     */
    convertMillisecondsToTime(milliseconds) {
        // Handle null, undefined, or invalid values
        if (milliseconds == null || typeof milliseconds !== 'number' || milliseconds < 0) {
            console.warn('Invalid time value:', milliseconds);
            return '00:00';
        }

        // Salesforce Time fields store milliseconds from midnight
        // 1 hour = 3,600,000 ms, 1 minute = 60,000 ms
        const totalMinutes = Math.floor(milliseconds / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        // Format with zero-padding
        const hoursStr = String(hours).padStart(2, '0');
        const minutesStr = String(minutes).padStart(2, '0');

        return `${hoursStr}:${minutesStr}`;
    }

    /**
     * Computed property to get player count display
     */
    get playerCountDisplay() {
        if (!this.game) return '0/0';
        return `${this.game.currentPlayers || 0}/${this.game.maxPlayers || 4}`;
    }

    /**
     * Computed property to get price per person
     */
    get pricePerPerson() {
        if (!this.game || this.game.pricePerPerson == null) return '0.00';
        try {
            const price = Number(this.game.pricePerPerson);
            if (isNaN(price)) return '0.00';
            return price.toFixed(2);
        } catch (error) {
            console.error('Error formatting price:', error, this.game.pricePerPerson);
            return '0.00';
        }
    }

    /**
     * Computed property to check if there are players
     */
    get hasPlayers() {
        return this.game && this.game.players && this.game.players.length > 0;
    }

    /**
     * Computed property to get players list
     */
    get players() {
        return this.game && this.game.players ? this.game.players : [];
    }

    /**
     * Computed property to enable actions for all players
     * Returns true to show action buttons (delete player, change payment status)
     */
    get showPlayerActions() {
        return true;
    }

    /**
     * Open join modal
     */
    handleJoinClick() {
        this.showJoinModal = true;
        this.loadPlayers();
    }

    /**
     * Close join modal
     */
    handleCancelJoin() {
        this.showJoinModal = false;
        this.resetForm();
    }

    /**
     * Handle player selection from combobox
     */
    handlePlayerSelect(event) {
        this.selectedPlayerId = event.detail.value;
    }

    /**
     * Open create player modal
     */
    handleCreatePlayerClick() {
        this.showCreatePlayerModal = true;
    }

    /**
     * Close create player modal
     */
    handleCancelCreatePlayer() {
        this.showCreatePlayerModal = false;
        this.newPlayerName = '';
    }

    /**
     * Handle input change for new player name
     */
    handleNewPlayerNameChange(event) {
        this.newPlayerName = event.target.value;
    }

    /**
     * Create new player
     */
    async handleSubmitCreatePlayer() {
        if (!this.newPlayerName || this.newPlayerName.trim() === '') {
            this.showToast('Błąd', 'Imię gracza jest wymagane', 'error');
            return;
        }

        this.isLoading = true;

        try {
            const playerId = await createPlayer({
                playerName: this.newPlayerName.trim()
            });

            this.showToast('Sukces', 'Gracz został utworzony', 'success');

            // Select the newly created player
            this.selectedPlayerId = playerId;

            // Reload players list
            await this.loadPlayers();

            // Close create player modal
            this.handleCancelCreatePlayer();
        } catch (error) {
            console.error('Error creating player:', error);
            const errorMessage = error.body?.message || error.message || 'Nie udało się utworzyć gracza';
            this.showToast('Błąd', errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Validate form inputs
     */
    validateForm() {
        if (!this.selectedPlayerId) {
            this.showToast('Błąd', 'Wybierz gracza lub utwórz nowego', 'error');
            return false;
        }

        return true;
    }

    /**
     * Handle join game submission
     * After successful DML operation, dispatches event to trigger parent refresh
     */
    async handleSubmitJoin() {
        if (!this.validateForm()) {
            return;
        }

        this.isLoading = true;

        try {
            await addPlayerToGame({
                gameId: this.game.gameId,
                playerId: this.selectedPlayerId
            });

            this.showToast('Sukces', 'Zostałeś dodany do gry!', 'success');

            // Close modal and reset form
            this.handleCancelJoin();

            // Dispatch event to parent component to refresh game list
            // This will trigger refreshApex() in padelBookingList
            this.dispatchEvent(new CustomEvent('playeradded', {
                detail: {
                    gameId: this.game.gameId
                },
                bubbles: true,
                composed: true
            }));

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
        this.selectedPlayerId = null;
        this.searchTerm = '';
        this.playerOptions = [];
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

    /**
     * Open delete game modal
     */
    handleDeleteGameClick() {
        this.showDeleteModal = true;
    }

    /**
     * Close delete game modal
     */
    handleCancelDelete() {
        this.showDeleteModal = false;
    }

    /**
     * Confirm and delete game
     * After successful deletion, dispatches event to trigger parent refresh
     */
    async handleConfirmDelete() {
        this.isLoading = true;

        try {
            await deleteGame({ gameId: this.game.gameId });

            this.showToast('Sukces', 'Gra została usunięta', 'success');

            // Close modal
            this.handleCancelDelete();

            // Dispatch event to parent component to refresh game list
            this.dispatchEvent(new CustomEvent('gamedeleted', {
                detail: {
                    gameId: this.game.gameId
                },
                bubbles: true,
                composed: true
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
     * Open edit game modal and populate with current values
     */
    handleEditGameClick() {
        this.editGameDate = this.game.gameDate;
        this.editGameTime = this.formatTimeForInput(this.game.gameTime);
        this.editTotalPrice = this.game.totalPrice;
        this.editDuration = this.game.duration;
        this.editNotes = this.game.notes || '';
        this.editMaxPlayers = this.game.maxPlayers;
        this.showEditModal = true;
    }

    /**
     * Close edit game modal
     */
    handleCancelEdit() {
        this.showEditModal = false;
        this.editGameDate = null;
        this.editGameTime = null;
        this.editTotalPrice = null;
        this.editDuration = null;
        this.editNotes = null;
        this.editMaxPlayers = null;
    }

    /**
     * Handle edit form field changes
     */
    handleEditDateChange(event) {
        this.editGameDate = event.target.value;
    }

    handleEditTimeChange(event) {
        this.editGameTime = event.target.value;
    }

    handleEditPriceChange(event) {
        this.editTotalPrice = event.target.value;
    }

    handleEditDurationChange(event) {
        this.editDuration = event.target.value;
    }

    handleEditNotesChange(event) {
        this.editNotes = event.target.value;
    }

    handleEditMaxPlayersChange(event) {
        this.editMaxPlayers = event.target.value;
    }

    /**
     * Convert Time object (milliseconds) to HH:mm format for input
     */
    formatTimeForInput(timeInMillis) {
        if (!timeInMillis) return '';

        const totalMinutes = Math.floor(timeInMillis / 60000);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        const hoursStr = String(hours).padStart(2, '0');
        const minutesStr = String(minutes).padStart(2, '0');

        return `${hoursStr}:${minutesStr}`;
    }

    /**
     * Confirm and update game
     * After successful update, dispatches event to trigger parent refresh
     */
    async handleConfirmEdit() {
        this.isLoading = true;

        try {
            await updateGame({
                gameId: this.game.gameId,
                courtId: null, // Not changing court in this version
                gameDate: this.editGameDate,
                gameTime: this.editGameTime,
                totalPrice: this.editTotalPrice ? parseFloat(this.editTotalPrice) : null,
                duration: this.editDuration ? parseFloat(this.editDuration) : null,
                notes: this.editNotes,
                maxPlayers: this.editMaxPlayers ? parseInt(this.editMaxPlayers, 10) : null
            });

            this.showToast('Sukces', 'Gra została zaktualizowana', 'success');

            // Close modal
            this.handleCancelEdit();

            // Dispatch event to parent component to refresh game list
            this.dispatchEvent(new CustomEvent('gameupdated', {
                detail: {
                    gameId: this.game.gameId
                },
                bubbles: true,
                composed: true
            }));

        } catch (error) {
            console.error('Error updating game:', error);
            const errorMessage = error.body?.message || error.message || 'Nie udało się zaktualizować gry';
            this.showToast('Błąd', errorMessage, 'error');
        } finally {
            this.isLoading = false;
        }
    }
}
