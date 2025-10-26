import { LightningElement, track } from 'lwc';

export default class PadelBookingApp extends LightningElement {
    @track activeTab = 'browse';

    get isBrowseTabActive() {
        return this.activeTab === 'browse';
    }

    get isCreateTabActive() {
        return this.activeTab === 'create';
    }

    get isMyGamesTabActive() {
        return this.activeTab === 'mygames';
    }

    handleTabClick(event) {
        this.activeTab = event.target.dataset.tab;
    }

    handleGameCreated(event) {
        // Switch to "My Games" tab after creating a game
        const gameId = event.detail.gameId;

        // Store game ID in localStorage for "My Games" tracking
        const myGames = JSON.parse(localStorage.getItem('padelMyGames') || '[]');
        if (!myGames.includes(gameId)) {
            myGames.push(gameId);
            localStorage.setItem('padelMyGames', JSON.stringify(myGames));
        }

        // Switch to My Games tab
        this.activeTab = 'mygames';

        // Refresh the browse list
        this.template.querySelector('c-padel-booking-list')?.refreshGames();
    }

    handlePlayerAdded() {
        // Refresh the browse list when a player joins
        this.template.querySelector('c-padel-booking-list')?.refreshGames();
    }

    handleGameDeleted(event) {
        const gameId = event.detail.gameId;

        // Remove from localStorage
        const myGames = JSON.parse(localStorage.getItem('padelMyGames') || '[]');
        const updatedGames = myGames.filter(id => id !== gameId);
        localStorage.setItem('padelMyGames', JSON.stringify(updatedGames));

        // Refresh browse list
        this.template.querySelector('c-padel-booking-list')?.refreshGames();
    }
}
