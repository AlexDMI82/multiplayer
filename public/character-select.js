// character-select.js - Handles character selection functionality

document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const characterCards = document.querySelectorAll('.character-card');
    const selectCharacterBtn = document.getElementById('select-character-btn');
    const selectionMessage = document.querySelector('.selection-message');
    
    let selectedCharacter = null;
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
        // Not logged in, redirect to login
        window.location.href = '/login.html';
        return;
    }
    
    // Parse user data
    const userData = JSON.parse(userStr);
    
    // Check if user already has a character class
    if (userData.characterClass) {
        // User already has character, redirect to lobby
        window.location.href = '/index.html';
        return;
    }
    
    // Add click event listeners to character cards
    characterCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove selected class from all cards
            characterCards.forEach(c => c.classList.remove('selected'));
            
            // Add selected class to clicked card
            card.classList.add('selected');
            
            // Store selected character
            selectedCharacter = card.getAttribute('data-character');
            
            // Enable select button
            selectCharacterBtn.disabled = false;
            
            // Update selection message
            selectionMessage.textContent = `${selectedCharacter.charAt(0).toUpperCase() + selectedCharacter.slice(1)} selected`;
        });
    });
    
    // Add click event listener to select button
    selectCharacterBtn.addEventListener('click', () => {
        if (!selectedCharacter) return;
        
        // Show loading state
        selectCharacterBtn.disabled = true;
        selectCharacterBtn.textContent = 'Processing...';
        
        // Send character selection to server
        fetch('/api/select-character', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ characterClass: selectedCharacter })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to select character');
            }
            return response.json();
        })
        .then(data => {
            // Update user data in localStorage
            const user = JSON.parse(localStorage.getItem('user'));
            user.characterClass = selectedCharacter;
            
            // Also store character bonuses for client-side use
            user.characterBonuses = getCharacterBonuses(selectedCharacter);
            
            localStorage.setItem('user', JSON.stringify(user));
            
            // Redirect to lobby
            window.location.href = '/index.html';
        })
        .catch(error => {
            console.error('Error selecting character:', error);
            selectCharacterBtn.disabled = false;
            selectCharacterBtn.textContent = 'Choose Character';
            selectionMessage.textContent = 'Error selecting character. Please try again.';
            selectionMessage.style.color = '#ff5252';
        });
    });
    
    // Function to get character bonuses based on character class
    function getCharacterBonuses(characterClass) {
        switch(characterClass) {
            case 'shadowsteel':
                return {
                    agility: 7,
                    strength: 3,
                    intuition: 0,
                    endurance: 0,
                    specialAbility: 'evade'
                };
            case 'ironbound':
                return {
                    agility: 0,
                    strength: 5,
                    intuition: 0,
                    endurance: 5,
                    specialAbility: 'ignoreBlock'
                };
            case 'flameheart':
                return {
                    agility: 0,
                    strength: 3,
                    intuition: 7,
                    endurance: 0,
                    specialAbility: 'criticalHit'
                };
            case 'venomfang':
                return {
                    agility: 5,
                    strength: 5,
                    intuition: 0,
                    endurance: 0,
                    specialAbility: 'poison'
                };
            default:
                return {
                    agility: 0,
                    strength: 0,
                    intuition: 0,
                    endurance: 0,
                    specialAbility: null
                };
        }
    }
});