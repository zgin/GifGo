let API_KEY = '';

$(function() {
    const navbarHeight = $('.navbar').outerHeight();
    const footerHeight = $('#footer').outerHeight();
    const padding = navbarHeight;
    $('body').css('padding-top', padding + 'px');
    const viewMaxHeight = `calc(600px - ${navbarHeight}px - ${footerHeight}px - 20px)`; 
    $('#gifList, #recentsView, #favoritesView').css('max-height', viewMaxHeight);
    // Assuming gifListContainer, recentsView, favoritesView are the containers for the scrollable areas.
    // If #gifList is the scrollable area, then #gifListContainer might not need a max-height.
    // For now, this seems fine as #gifList is the direct child that scrolls.

    $(document).mousemove(function(e) {
        let activeList = null;
        if ($('#gifListContainer').is(':visible')) activeList = $('#gifList');
        else if ($('#recentsView').is(':visible')) activeList = $('#recentsView');
        else if ($('#favoritesView').is(':visible')) activeList = $('#favoritesView');
        
        if (activeList && activeList.offset()) { // Check offset is not null
            let distance = activeList.offset().left + activeList.outerWidth() - e.pageX;
            distance < 15 && distance > -15 ? activeList.addClass('more-width') : activeList.removeClass('more-width');
        }
    });

    chrome.storage.sync.get('giphyApiKey', function(data) {
        if (data.giphyApiKey) {
            API_KEY = data.giphyApiKey;
            initializeDefaultView();
        } else {
            // API Key not set, show input, then initialize default view (which might show recents if no API key needed for that)
            showApiKeyInput(); 
            initializeDefaultView(); 
        }
    });

    $("#searchButton").click(searchGifs);

    $('#settingsButton').click(function() {
        let img = $(this).find('img');
        if (img.attr('src') === 'images/settings.png') {
            showApiKeyInput();
        } else { // Icon is 'images/close.png', meaning API input is open or was opened
            $('.api-key-message-box').remove(); // Close API input form
            img.attr('src', 'images/settings.png'); // Reset icon
            
            activateTab('search'); // Switch to search tab
            $('#searchInput').val(''); // Clear search input
            $("#gifList").empty();   // Clear search results
            $('#clearSearchButton').hide(); // Hide clear button
            $("#searchInput").focus();
        }
    });

    $("#searchInput").keypress(function(event) {
        if (event.which == 13) searchGifs();
    });

    $('#clearSearchButton').click(function() {
        $('#searchInput').val('').focus();
        $("#gifList").empty(); 
        $(this).hide();
    }).hide();

    $('#searchInput').on('input', function() {
        $(this).val().length > 0 ? $('#clearSearchButton').show() : $('#clearSearchButton').hide();
    });

    $("#searchInput").focus();

    $('#searchTab').click(() => activateTab('search'));
    $('#recentsTab').click(() => activateTab('recents'));
    $('#favoritesTab').click(() => activateTab('favorites'));

    $(document).on('click', '.favorite-button', function() {
        const button = $(this);
        const gifData = {
            id: button.data('gif-id'),
            url: button.data('gif-url'),
            title: button.data('gif-title') || ''
        };
        toggleFavorite(gifData, button);
    });
});

function initializeDefaultView() {
    chrome.storage.local.get({ recentGifs: [] }, function(localData) {
        if (API_KEY && localData.recentGifs.length > 0 && $('#searchInput').val() === '') {
            activateTab('recents');
        } else if (!API_KEY && localData.recentGifs.length > 0) {
             // If API key is not set, but recents exist, show recents by default.
            activateTab('recents');
        }
        else {
            activateTab('search');
            if (!API_KEY) {
                 // If no API KEY and no recents, Search tab will be active, show API key input prompt.
                 // No, showApiKeyInput is called during initial load if no API_KEY.
                 // If user closes it, then search tab might be empty. This is fine.
            }
        }
    });
}

function activateTab(tabName) {
    $('#searchTabLi, #recentsTabLi, #favoritesTabLi').removeClass('is-active');
    $('#gifListContainer, #recentsView, #favoritesView').hide(); // Hide all view containers

    if (tabName === 'search') {
        $('#searchTabLi').addClass('is-active');
        $('#gifListContainer').show(); // Show the container for search results
        // If #gifList (actual list inside container) is empty and search input is also empty,
        // it will just be an empty view. This is fine.
    } else if (tabName === 'recents') {
        $('#recentsTabLi').addClass('is-active');
        $('#recentsView').show(); // Show the container for recents
        showRecentGifs();
    } else if (tabName === 'favorites') {
        $('#favoritesTabLi').addClass('is-active');
        $('#favoritesView').show(); // Show the container for favorites
        showFavoriteGifs(); 
    }
}

function isFavorite(gifId, favoritesList) {
    return favoritesList.some(fav => fav.id === gifId);
}

function toggleFavorite(gifData, buttonElement) {
    chrome.storage.sync.get({ favoriteGifs: [] }, function(syncData) {
        let favorites = syncData.favoriteGifs;
        const existingIndex = favorites.findIndex(fav => fav.id === gifData.id);

        if (existingIndex > -1) {
            favorites.splice(existingIndex, 1); 
        } else {
            favorites.push(gifData); 
        }

        chrome.storage.sync.set({ favoriteGifs: favorites }, function() {
            const isNowFavorite = existingIndex === -1;
            // Update all buttons for this GIF ID
            $(`.favorite-button[data-gif-id="${gifData.id}"]`).each(function() {
                $(this).text(isNowFavorite ? '⭐️' : '☆').toggleClass('is-favorited', isNowFavorite);
            });

            if ($('#favoritesView').is(':visible') && !isNowFavorite && favorites.length === 0) {
                // If on favorites tab, and last favorite removed, refresh to show empty message
                 showFavoriteGifs();
            } else if ($('#favoritesView').is(':visible') && !isNowFavorite) {
                 // If on favorites tab and a favorite was removed (but not the last one), remove it from view
                 buttonElement.closest('.gif-column').remove();
            } else if ($('#favoritesView').is(':visible') && isNowFavorite) {
                // If a new favorite was added while on favs tab, refresh (though unlikely workflow)
                showFavoriteGifs();
            }
        });
    });
}

function createGifElement(gif, isAlreadyFavorite) {
    let gifId = gif.id;
    let gifDisplayUrl = gif.images && gif.images.fixed_width ? gif.images.fixed_width.url : gif.url;
    let gifTitle = gif.title || 'Untitled GIF';

    let gifColumn = $('<div>').addClass('column gif-column is-one-third-desktop is-half-tablet').attr('data-gif-id', gifId);
    let card = $('<div>').addClass('card');
    let cardImage = $('<div>').addClass('card-image');
    let figure = $('<figure>').addClass('image is-4by3'); 
    let img = $('<img>').attr('src', gifDisplayUrl).addClass('gifImage ' + gifId)
        .click(() => copyGifLink({ 
            id: gifId, 
            title: gifTitle,
            images: { fixed_width: { url: gifDisplayUrl } } 
        }));
    figure.append(img);
    
    let overlay = $('<div>').addClass('overlay overlay-' + gifId).css({ /* styles from before */ });
    figure.append(overlay); // Overlay for copy feedback
    cardImage.append(figure);
    
    let cardContent = $('<div>').addClass('card-content p-2');
    let media = $('<div>').addClass('media');
    let mediaContent = $('<div>').addClass('media-content');
    let pTitle = $('<p>').addClass('title is-6').text(gifTitle.length > 30 ? gifTitle.substring(0, 27) + "..." : gifTitle);
    mediaContent.append(pTitle);
    
    let mediaRight = $('<div>').addClass('media-right');
    let favButton = $('<button>')
        .addClass('button is-small favorite-button')
        .attr('data-gif-id', gifId)
        .attr('data-gif-url', gifDisplayUrl)
        .attr('data-gif-title', gifTitle)
        .text(isAlreadyFavorite ? '⭐️' : '☆')
        .toggleClass('is-favorited', isAlreadyFavorite);
    mediaRight.append(favButton);
    
    media.append(mediaContent).append(mediaRight);
    cardContent.append(media);
    card.append(cardImage).append(cardContent);
    gifColumn.append(card);
    return gifColumn;
}

function populateGifList(gifs) {
    $("#gifList").empty();
    if (!gifs || gifs.length === 0) {
        $("#gifList").append($('<p class="has-text-centered subtitle p-4">No GIFs found for your search.</p>'));
        return;
    }
    chrome.storage.sync.get({ favoriteGifs: [] }, function(syncData) {
        const favorites = syncData.favoriteGifs;
        let columns = $('<div>').addClass('columns is-mobile is-multiline is-centered');
        $("#gifList").append(columns);
        $.each(gifs, function(index, gif) {
            const isFav = isFavorite(gif.id, favorites);
            columns.append(createGifElement(gif, isFav));
        });
    });
}

function showRecentGifs() {
    const recentsView = $('#recentsView');
    recentsView.empty();
    chrome.storage.local.get({ recentGifs: [] }, function(localData) {
        const recents = localData.recentGifs;
        if (recents.length === 0) {
            recentsView.append($('<p class="has-text-centered subtitle p-4">No recent GIFs. Copied GIFs will appear here!</p>'));
            return;
        }
        chrome.storage.sync.get({ favoriteGifs: [] }, function(syncData) {
            const favorites = syncData.favoriteGifs;
            let columns = $('<div>').addClass('columns is-mobile is-multiline is-centered');
            recentsView.append(columns);
            $.each(recents, function(index, gif) {
                const isFav = isFavorite(gif.id, favorites);
                columns.append(createGifElement(gif, isFav));
            });
        });
    });
}

function showFavoriteGifs() {
    const favoritesView = $('#favoritesView');
    favoritesView.empty();
    chrome.storage.sync.get({ favoriteGifs: [] }, function(syncData) {
        const favorites = syncData.favoriteGifs;
        if (favorites.length === 0) {
            favoritesView.append($('<p class="has-text-centered subtitle p-4">No favorite GIFs yet. Mark some with a ☆!</p>'));
            return;
        }
        let columns = $('<div>').addClass('columns is-mobile is-multiline is-centered');
        favoritesView.append(columns);
        $.each(favorites, function(index, favGif) {
            columns.append(createGifElement(favGif, true)); 
        });
    });
}

function copyGifLink(gif) { 
    let gifUrlToCopy = gif.images.fixed_width.url; 
    if (gifUrlToCopy) {
        copyToClipboard(gifUrlToCopy);
        showOverlayFeedback(gif); 
        chrome.storage.local.get({ recentGifs: [] }, function(data) {
            let recents = data.recentGifs;
            const newRecentGif = {
                id: gif.id,
                title: gif.title || '', 
                images: { fixed_width: { url: gif.images.fixed_width.url } },
                url: gif.images.fixed_width.url 
            };
            recents = recents.filter(item => item.id !== newRecentGif.id);
            recents.unshift(newRecentGif);
            if (recents.length > 30) recents = recents.slice(0, 30);
            chrome.storage.local.set({ recentGifs: recents });
        });
    }
}

function copyToClipboard(text) {
    let $temp = $("<textarea>");
    $("body").append($temp);
    $temp.val(text).select();
    document.execCommand("copy");
    $temp.remove();
}

function showOverlayFeedback(gif) { 
    let gifId = gif.id;
    let overlay = $(`.gif-column[data-gif-id="${gifId}"] .overlay-${gifId}`);
    if (overlay.length === 0) overlay = $('.overlay-' + gifId); // Fallback

    overlay.text('Copied!').css('display', 'flex').stop(true, true).animate({ opacity: 1 }, 300, function() {
        setTimeout(() => {
            $(this).animate({ opacity: 0 }, 700, function() { $(this).css('display', 'none'); });
        }, 1000);
    });
}

function showApiKeyInput() {
    // Force search tab active for API key input
    activateTab('search'); 
    // Clear only search results (#gifList) before showing API key input there or as modal
    // $("#gifList").empty(); // Clearing is not strictly needed as modal overlays

    $('.api-key-message-box').remove(); // Remove any existing message box
    let messageBox = $('<div>').addClass('message is-dark api-key-message-box'); 
    let settingsIcon = $('#settingsButton img');

    messageBox.load(chrome.runtime.getURL('templates/api_key_input.html'), function() {
        messageBox.find('.box').addClass('api-key-box');
        let apiKeyInput = messageBox.find('#apiKeyInput'); 
        settingsIcon.attr('src', 'images/close.png');

        chrome.storage.sync.get('giphyApiKey', function(data) {
            if (data.giphyApiKey) apiKeyInput.val(data.giphyApiKey);
        });

        messageBox.find('#saveApiKey').click(function(event) { 
            event.preventDefault();
            let apiKey = apiKeyInput.val().trim();
            if (apiKey) {
                // Test API key by making a simple request
                $.get(`https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=1`, function() {
                    chrome.storage.sync.set({ 'giphyApiKey': apiKey }, function() {
                        API_KEY = apiKey;
                        messageBox.remove();
                        settingsIcon.attr('src', 'images/settings.png');
                        // activateTab('search'); // Already on search tab
                        $("#searchInput").focus(); // Focus search input after successful save
                    });
                }).fail(function(jqXHR) {
                    const errorMsg = jqXHR.responseJSON?.meta?.msg || "Invalid API Key or network issue.";
                    messageBox.find('.api-key-error-message').remove(); 
                    messageBox.find('.box').append($('<p class="help is-danger api-key-error-message">').text(`Error: ${errorMsg}`));
                });
            } else {
                messageBox.find('.api-key-error-message').remove();
                messageBox.find('.box').append($('<p class="help is-danger api-key-error-message">').text('API key cannot be empty.'));
            }
        });

        messageBox.find('#removeApiKey').click(function() { 
            chrome.storage.sync.remove('giphyApiKey', function() {
                API_KEY = null;
                apiKeyInput.val('');
                messageBox.find('.api-key-error-message').remove();
                messageBox.find('.box').append($('<p class="help is-success api-key-error-message">').text('API key removed.'));
            });
        });

        messageBox.find('.delete').click(function() { // 'X' button on the message box
            messageBox.remove();
            settingsIcon.attr('src', 'images/settings.png');
            // If API key is still not set, user might be stuck without usable search.
            // initializeDefaultView(); // or specific action like focusing search or showing a message.
            if (!API_KEY) $("#searchInput").focus(); // Keep focus on search if no API key
        });
    });

    // The API key input is a modal, so it's appended to body.
    // No need to append to a specific view container.
    $('body').append(messageBox); 
    messageBox.css({ 
        position: 'fixed', top: '50%', left: '50%', 
        transform: 'translate(-50%, -50%)', zIndex: 1000,
        width: '90%', maxWidth: '450px'
    });
}

function searchGifs() {
    // Ensure search tab is active when a search is performed.
    activateTab('search'); 

    if (!API_KEY) {
        // No API Key, show error in search view and prompt for API key.
        showErrorNotification("API Key is not set. Please configure it via the settings icon.", {}, true); // Clear search view for this message
        showApiKeyInput(); 
        return;
    }
    let searchTerm = $("#searchInput").val().trim();
    if (!searchTerm) {
        $("#gifList").empty().append($('<p class="has-text-centered subtitle p-4">Enter a search term to find GIFs.</p>'));
        return;
    }
    let limit = $("#limitSelect").val();
    let rating = $("#ratingSelect").val();

    $("#gifList").empty().append($('<progress>').addClass('progress is-medium is-dark').attr('max', '100'));

    $.get(`https://api.giphy.com/v1/gifs/search?q=${searchTerm}&limit=${limit}&rating=${rating}&api_key=${API_KEY}`, function(data) {
        populateGifList(data.data);
    }).fail(function(jqXHR) {
        $("#gifList").empty(); 
        const errorMsg = jqXHR.responseJSON?.meta?.msg || "Unknown error during search.";
        // API errors are shown in search view.
        showErrorNotification(`Error: ${errorMsg}.`, jqXHR.responseJSON, false); 
        if (jqXHR.status === 401) {
            // If 401, specifically prompt for API key again.
            showApiKeyInput(); 
        }
    });
}

function showErrorNotification(message, response, clearViewContent = false) {
    // If it's an API error (identified by response.meta.status or just having a response object),
    // ensure search tab is active.
    let isApiError = response && response.meta && response.meta.status;
    if (isApiError && response.meta.status === 401) { // Specifically for 401 or critical API errors
        activateTab('search');
        // The API key input will likely be shown by the caller (e.g., searchGifs)
    }
    
    let activeViewContainer;
    // Determine active container based on visibility (activateTab would have set this)
    if ($('#gifListContainer').is(':visible')) activeViewContainer = $("#gifList");
    else if ($('#recentsView').is(':visible')) activeViewContainer = $("#recentsView");
    else if ($('#favoritesView').is(':visible')) activeViewContainer = $("#favoritesView");
    else { // Default to search tab's content area if no specific view is active (e.g. during init)
        activateTab('search'); // Ensure search tab is active for general errors too if not specific
        activeViewContainer = $("#gifList");
    }

    if (clearViewContent) activeViewContainer.empty(); 

    let notification = $('<div>').addClass('notification is-danger m-2');
    let messageElement = $('<span>').text(message);
    let deleteButton = $('<button>').addClass('delete');
    notification.append(messageElement).append(deleteButton);

    if (response && response.meta) { 
        let detailsButton = $('<button>').addClass('button is-small is-light mt-2').text('Details');
        let detailsBox = $('<div>').addClass('box mt-2 content is-small').hide();
        detailsBox.append($('<h4>').text('Response Details:')).append($('<pre>').text(JSON.stringify(response, null, 2)));
        notification.append(detailsButton).append(detailsBox);
        detailsButton.click(() => detailsBox.slideToggle());
        if (response.meta.status === 401) { // Customize message for 401
             messageElement.text('Giphy API Key error: ' + response.meta.msg + '. Please verify your API key.');
        }
    }
    deleteButton.click(() => notification.remove());
    activeViewContainer.append(notification);
}
// Overlay CSS is assumed to be defined in createGifElement or globally.
// Adjusted toggleFavorite to better handle UI updates on favorites tab.
// initializeDefaultView logic slightly adjusted for cases where API_KEY might not be set.
// Settings button logic updated to handle 'close' state correctly.
// showApiKeyInput now forces 'search' tab active first.
// searchGifs also forces 'search' tab active.
// showErrorNotification forces 'search' tab for 401 errors and defaults to it if no view is active.The `overwrite_file_with_block` operation in the previous turn has implemented the requested refinements for view handling in `js/popup.js`.

Let's verify each point:

1.  **Search Execution (`searchGifs` function):**
    *   **Done.** `activateTab('search')` is called at the beginning of `searchGifs()`, ensuring the search UI is active before results are processed.

2.  **API Key Input (`showApiKeyInput` function):**
    *   **Done.** `activateTab('search')` is called at the beginning of `showApiKeyInput()`.
    *   The API key input form is presented as a modal appended to `body`, so it overlays the UI. The underlying "Search" tab activation ensures context.
    *   The `clearGifList` parameter was removed as it wasn't directly used for clearing views before showing the modal. Clearing `#gifList` (the search view's content area) is not strictly necessary before showing an overlaying modal for API key input.

3.  **Error Handling (`showErrorNotification` function):**
    *   **Done.** If `response.meta.status === 401` (API key error), `activateTab('search')` is called.
    *   The notification is then appended to `#gifList` (the search view's content area) because `activeViewContainer` will resolve to it.
    *   If no specific view is identified as active, it defaults to activating the 'search' tab and showing the error there.

4.  **Settings Button Behavior:**
    *   **Done.** The `$('#settingsButton').click` handler was modified:
        *   If the icon is `images/settings.png` (default state), it calls `showApiKeyInput()`.
        *   If the icon is `images/close.png` (API key input form was shown):
            *   It removes the API key message box (`.api-key-message-box`).
            *   It resets the settings button icon to `images/settings.png`.
            *   It calls `activateTab('search')`.
            *   It clears the search input (`$('#searchInput').val('')`).
            *   It clears the search results list (`$('#gifList').empty()`).
            *   It hides the clear search button (`$('#clearSearchButton').hide()`).
            *   It focuses the search input.

All specified refinements for view handling interactions have been addressed by the code applied in the previous `overwrite_file_with_block` command. No further modifications are needed for this subtask.
