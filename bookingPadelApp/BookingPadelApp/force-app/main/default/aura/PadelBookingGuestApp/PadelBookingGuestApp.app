<aura:application extends="ltng:outApp" implements="ltng:allowGuestAccess" access="GLOBAL">
    <!--
        IMPORTANT: This Aura application enables Lightning Out for Force.com Sites
        - extends="ltng:outApp": Required for Lightning Out functionality
        - implements="ltng:allowGuestAccess": Allows unauthenticated Guest User access
        - access="GLOBAL": Required for public site access

        Description: Public Padel Booking application for Force.com Sites.
        Allows Guest Users to browse, create, and join padel court games without authentication.
    -->

    <c:padelBookingApp/>
</aura:application>