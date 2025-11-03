import { LightningElement, track } from 'lwc';

export default class PadelBookingApp extends LightningElement {
    @track activeTab = 'browse';

    get isBrowseTabActive() {
        return this.activeTab === 'browse';
    }

    get isCreateTabActive() {
        return this.activeTab === 'create';
    }

    handleTabClick(event) {
        this.activeTab = event.target.dataset.tab;
    }

    handleGameCreated() {
        // Switch back to browse tab after creating a game
        this.activeTab = 'browse';

        // Refresh the browse list
        this.template.querySelector('c-padel-booking-list')?.refreshGames();
    }

    handlePlayerAdded() {
        // Refresh the browse list when a player joins
        this.template.querySelector('c-padel-booking-list')?.refreshGames();
    }
}
