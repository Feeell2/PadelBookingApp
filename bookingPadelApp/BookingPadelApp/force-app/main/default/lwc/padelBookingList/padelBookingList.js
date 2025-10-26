import { LightningElement } from 'lwc';
import getAvailableGames from '@salesforce/apex/PadelGameController.getAvailableGames';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PadelBookingList extends LightningElement {
    games = [];
    error;
    isLoading = false;

    connectedCallback() {
        this.loadGames();
    }

    loadGames() {
        this.isLoading = false;
        this.error = undefined;
        console.log(this.isLoading);
        
        getAvailableGames()

            .then(result => {
                this.games = result;
                this.error = undefined;
                console.log(JSON.stringify(result));
                console.log('Games loaded:', this.games.length);
            })
            .catch(error => {
                this.error = error;
                this.games = [];
                console.error('Error loading games:', error);
                this.showToast('Błąd', 'Nie udało się pobrać listy gier', 'error');
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    get hasGames() {
        console.log(this.games && this.games.length > 0);
        
        return this.games && this.games.length > 0;
    }

    get noGamesMessage() {
        return 'Brak dostępnych gier. Stwórz nową grę!';
    }

    refreshGames() {
        this.loadGames();
    }

    handlePlayerAdded() {
        this.refreshGames();
        // Dispatch event to parent
        this.dispatchEvent(new CustomEvent('playeradded'));
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
