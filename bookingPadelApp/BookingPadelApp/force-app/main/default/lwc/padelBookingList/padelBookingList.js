import { LightningElement } from 'lwc';
import getAvailableGames from '@salesforce/apex/PadelGameController.getAvailableGames';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PadelBookingList extends LightningElement {
    games = [];
    error;
    isLoading = true;

    /**
     * Load games on component initialization
     */
    connectedCallback() {
        this.loadGames();
    }

    get hasGames() {
        return this.games && this.games.length > 0;
    }

    get noGamesMessage() {
        return 'Brak dostępnych gier. Stwórz nową grę!';
    }

    /**
     * Load games from Apex - imperative call
     * Includes a small delay to allow Salesforce to update roll-up summary fields
     */
    async loadGames() {
        this.isLoading = true;
        try {
            // Wait 500ms to allow roll-up summary fields (Current_Players__c) to update

            const data = await getAvailableGames();
            this.games = data;

            // Sort games by date only (ascending - oldest first)
            if (this.games && this.games.length > 0) {
                this.games.sort((a, b) => {
                    const dateA = new Date(a.gameDate);
                    const dateB = new Date(b.gameDate);
                    return dateA - dateB;
                });
            }

            this.error = undefined;
            console.log('Games loaded:', this.games.length);

            // Debug: Log first game to see data structure
            if (this.games && this.games.length > 0) {
                console.log('First game data:', JSON.stringify(this.games[0]));
            }
        } catch (error) {
            this.error = error;
            this.games = [];
            console.error('Error loading games:', error);
            this.showToast('Błąd', 'Nie udało się pobrać listy gier', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Refresh games data - alias for loadGames for backward compatibility
     * This method can be called by parent components or in response to custom events
     */
    async refreshGames() {
        await this.loadGames();
    }

    /**
     * Handle player added event from child components
     * Automatically refreshes game list
     */
    handlePlayerAdded() {
        this.refreshGames();
        // Dispatch event to parent for any additional handling
        this.dispatchEvent(new CustomEvent('playeradded'));
    }

    /**
     * Handle game deleted event from child components
     * Automatically refreshes game list
     */
    handleGameDeleted() {
        this.refreshGames();
        // Dispatch event to parent for any additional handling
        this.dispatchEvent(new CustomEvent('gamedeleted'));
    }

    /**
     * Handle game updated event from child components
     * Automatically refreshes game list
     */
    handleGameUpdated() {
        this.refreshGames();
        // Dispatch event to parent for any additional handling
        this.dispatchEvent(new CustomEvent('gameupdated'));
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}
