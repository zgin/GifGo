let API_KEY = '';

$(function() {

    const navbarHeight = $('.navbar').outerHeight();
    const footerHeight = $('#footer').outerHeight();
    console.log(footerHeight);
    console.log(navbarHeight);
    const padding = navbarHeight;
    $('body').css('padding-top', padding + 'px');
    $('#gifList').css('max-height', 600 - (navbarHeight + footerHeight) - 10 + 'px');
    $('#gifListContainer').css('max-height', 600 - (navbarHeight + footerHeight) - 10 + 'px')

    $(document).mousemove(function(e) {
        let ele = $('#gifList');
        let distance = ele.offset().left + ele.outerWidth() - e.pageX;
        distance < 15 && distance > -15 ? ele.addClass('more-width') : ele.removeClass('more-width');
    });


    // Get user's Giphy API key from storage
    chrome.storage.sync.get('giphyApiKey', function(data) {
        if (data.giphyApiKey) {
            API_KEY = data.giphyApiKey;
        } else {
            showApiKeyInput();
        }
    });

    $("#searchButton").click(searchGifs);
    $('#settingsButton').click(function() {
        let imgSrc = $(this).find('img').attr('src');
        if (imgSrc === 'images/settings.png') {
            showApiKeyInput();
        } else if (imgSrc === 'images/close.png') {
            $("#gifList").empty();
        }
        $(this).find('img').animate({width: 'toggle'}, 200, function() {
            $(this).attr('src', imgSrc === 'images/settings.png' ? 'images/close.png' : 'images/settings.png').animate({width: 'toggle'}, 200);
        });
    });
    $("#searchInput").keypress(function(event) {
        if (event.which == 13) { // Enter key
            searchGifs();
        }
    });
    $('#clearSearchButton').click(function() {
        $('#searchInput').val('');
        $("#gifList").empty();
    });
    $('#clearSearchButton').hide(); // Hide the button by default

    $('#searchInput').on('input', function() {
        if ($(this).val().length > 0) {
            $('#clearSearchButton').show(); // Show the button when there is content
        } else {
            $('#clearSearchButton').hide(); // Hide the button when there is no content
        }
    });

    $('#clearSearchButton').click(function() {
        $('#searchInput').val('');
        $("#gifList").empty();
        $('#clearSearchButton').hide(); // Hide the button after clearing the input
    });

    $("#searchInput").focus();
    
});

function showApiKeyInput(clearGifList = true) {
    if (clearGifList) { $("#gifList").empty(); }
    let messageBox = $('<div>').addClass('message');
    console.log('do api key stuff');
    messageBox.load(chrome.runtime.getURL('templates/api_key_input.html'), function() {
        let apiKeyInput = messageBox.find('.input');
        chrome.storage.sync.get('giphyApiKey', function(data) {
            if (data.giphyApiKey) {
                apiKeyInput.val(data.giphyApiKey);
            }
        });
        messageBox.find('.is-primary').click(function() {
            event.preventDefault();
            console.log("Saving API key...");
            let apiKey = apiKeyInput.val();
            if (apiKey) {
                // Test the API key before saving it
                $.get(`https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}`, function(data) {
                    chrome.storage.sync.set({ 'giphyApiKey': apiKey }, function() {
                        API_KEY = apiKey;
                        messageBox.remove();
                    });
                }).fail(function(jqXHR) {
                    let errorThrown = jqXHR.responseJSON.meta.msg;
                    let message = `Error searching for gifs: ${errorThrown}.`;
                    console.log("Error searching for gifs: " + errorThrown);
                    showErrorNotification(message, jqXHR.responseJSON);
                });
            }
        });
        messageBox.find('.is-danger').click(function() {
            chrome.storage.sync.remove('giphyApiKey', function() {
                API_KEY = null;
                messageBox.remove();
            });
        });
        messageBox.find('.delete').click(function() {
            messageBox.remove();
        });
    });

    $("#gifList").append(messageBox);
}


function searchGifs() {
    let searchTerm = $("#searchInput").val();
    let limit = $("#limitSelect").val();
    let rating = $("#ratingSelect").val();

    $("#gifList").empty();

    let progressBar = $('<progress>').addClass('progress is-medium is-dark').attr('max', '100');
    $("#gifList").empty().append(progressBar);

    $.get(`https://api.giphy.com/v1/gifs/search?q=${searchTerm}&limit=${limit}&rating=${rating}&api_key=${API_KEY}`, function(data) {
        populateGifList(data.data);
    }).fail(function(jqXHR) {
        $("#gifList").empty()
        let errorThrown = jqXHR.responseJSON.meta.msg;
        let message = `Error searching for gifs: ${errorThrown}.`;
        let response = jqXHR.responseJSON;             
        showErrorNotification(message, jqXHR.responseJSON, false);
        if (response.meta.status === 401) {
            showApiKeyInput(false);
        }   
    });
}

function showErrorNotification(message, response, clearGifList = false) {
    if (clearGifList) { $("#gifList").empty(); }
    let notification = $('<div>').addClass('notification is-danger');
    let messageElement = $('<span>').text(message);
    let detailsButton = $('<button>').addClass('button is-small is-light').text('Click To View Response Details').css('margin-top', '0.5rem');
    let detailsBox = $('<div>').addClass('box').hide();
    let detailsHeader = $('<div>').addClass('subtitle').text('Response Details:');
    let detailsBody = $('<pre>').text(JSON.stringify(response, null, 2));
    let deleteButton = $('<button>').addClass('delete');
    let messageContainer = $('<div>').addClass('message-container').css('display', 'flex').css('flex-direction', 'column').append(messageElement).append(detailsButton);
    notification.append(messageContainer).append(deleteButton).append(detailsBox);
    detailsBox.append(detailsHeader).append(detailsBody);
    detailsButton.click(function() {
        detailsBox.slideToggle(function() {
            window.scrollTo(0, document.body.scrollHeight);
        });
    });
    deleteButton.click(function() {
        notification.remove();
    });
    if (response.meta.status === 401) {
        messageElement.text('Giphy responded with a 401 status indicating that the API Key is bad or that you have insufficient privileges. Please verify that your API key is correct.');
    }
    $("#gifList").append(notification);
    notification.scrollTop(notification[0].scrollHeight);
}


function populateGifList(gifs) {
    $("#gifList").empty();

    let columnClass = `is-half`;
    let columns = $('<div>').addClass('columns is-mobile is-multiline');
    columns.id = 'gifColumns';
        $("#gifList").append(columns);

    $.each(gifs, function(index, gif) {
        let gifId = gif.id;
        let gifColumn = $('<div>').addClass('column gif-column ' + columnClass).attr('data-gif-id', gifId);
        let flexContainer = $('<div>').addClass('flex-container');
        let img = $('<img>').attr('src', gif.images.fixed_width.url).addClass('gifImage ' + gifId).click(() => copyGifLink(gif));
        let overlay = $('<div>').addClass('overlay overlay-' + gifId);
        
        flexContainer.append(img).append(overlay);
        gifColumn.append(flexContainer);
        
        columns.append(gifColumn);
    });
}

function copyGifLink(gif) {
    let sizes = gif.images;
    let gifUrl = null;

    let sortedSizes = Object.values(sizes).sort((a, b) => parseInt(b.size) - parseInt(a.size));
    $.each(sortedSizes, function(index, size) {
        if (size.size && parseInt(size.size) < 2000000) {
            gifUrl = size.url;
            return false;
        }
    });

    if (gifUrl) {
        let urlWithoutParams = gifUrl.split('?')[0]; // Extract the URL without the query parameters
        copyToClipboard(urlWithoutParams);
        showOverlayFeedback(gif);
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
    let overlay = $('.overlay-' + gifId);

    overlay.text('Copied To Clipboard!').css('display', 'flex').animate({ opacity: 1 }, 300, function() {
        setTimeout(() => {
            overlay.animate({ opacity: 0 }, 700, function() {
                overlay.css('display', 'none');
            });
        }, 1000);
    });
}

