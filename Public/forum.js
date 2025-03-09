const navbar = document.querySelector('.navbar');

window.addEventListener('scroll', () => {
    if (window.scrollY > 200) { 
        navbar.classList.add('hidden');
    } else {
        navbar.classList.remove('hidden');
    }
});

document.getElementById('search-btn').addEventListener('click', function() {
// Get the search query entered by the user
var query = document.getElementById('search-input').value.toLowerCase();

resetHighlights();

var sections = document.querySelectorAll('h1, h2, h3, p');

var found = false; 
var firstMatch = null; 

sections.forEach(function(section) {
    var text = section.innerHTML.toLowerCase();
    var index = text.indexOf(query);
    
    if (index !== -1) {
        // Highlight the matched text only
        var originalText = section.innerHTML;
        var highlightedText = highlightText(originalText, query);
        section.innerHTML = highlightedText;

        if (!firstMatch) {
            firstMatch = section; 
        }
        found = true;
    }
});
if (found && firstMatch) {
    firstMatch.scrollIntoView({ behavior: "smooth", block: "center" });
}
// If no match was found, alert the user 
if (!found) {
    alert('No matching content found!');
}
});
// Function to wrap matched text in a span with a highlight class
function highlightText(text, query) {
var regex = new RegExp(query, "gi");
return text.replace(regex, function(match) {
    return `<span class="highlight">${match}</span>`;
});
}
function resetHighlights() {
var highlighted = document.querySelectorAll('.highlight');
highlighted.forEach(function(span) {
    span.outerHTML = span.innerHTML; 
});
}
// Add event listener for the "Enter" key on the search input
document.getElementById('search-input').addEventListener('keypress', function(event) {
if (event.key === 'Enter') {
    event.preventDefault(); 
}
});


//forum code
// Wrap everything in an IIFE to avoid global scope pollution
(function() {
    // DOM Elements
    const commentsContainer = document.querySelector('.interactive-comments');
    const getElement = selector => commentsContainer.querySelector(selector);
    const getAllElements = selector => commentsContainer.querySelectorAll(selector);
    
    const loginUsernameInput = getElement("#login-username");
    const loginButton = getElement("#login-btn");
    const logoutButton = getElement("#logout-btn");
    const commentInputSection = getElement("#comment-input-section");
    const commentTextarea = getElement(".reply-input .cmnt-input");
    const commentsWrapper = getElement(".comments-wrp");
    const sendButton = getElement(".reply-input .bu-primary");
    
    let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;
    let finalData;
    const API_URL = 'http://localhost:3000';

    console.log({
        commentInputSection,
        commentTextarea,
        sendButton
    });

    // Enhanced popup 
    const createPopup = (message, type = 'info') => {
        const popup = document.createElement("div");
        popup.className = `popup ${type}`;
        popup.innerHTML = `<p>${message}</p>`;
        commentsContainer.appendChild(popup);
        
        setTimeout(() => {
            if (popup && popup.parentNode) {
                popup.remove();
            }
        }, 3000);
    };

    async function loadData() {
        try {
            const response = await fetch(`${API_URL}/api/comments`);
            if (!response.ok) throw new Error('Failed to fetch comments');
            const comments = await response.json();
            finalData = { comments: Array.isArray(comments) ? comments : [] };
            return finalData;
        } catch (error) {
            createPopup("Failed to load comments", "error");
            return { comments: [] };
        }
    }

    function appendFrag(frag, parent) {
        var children = [].slice.call(frag.childNodes, 0);
        parent.appendChild(frag);
        return children[1];
    }

    const addComment = async (body, parentId, replyTo = undefined) => {
        if (!currentUser) {
            createPopup("Please log in to comment", "error");
            return;
        }

        if (!body.trim()) {
            createPopup("Comment cannot be empty", "error");
            return;
        }

        const newComment = {
            parent: parentId || 0,
            content: body,
            createdAt: new Date().toISOString(),
            replyingTo: replyTo,
            score: 0,
            user: {
                username: currentUser.username,
                image: {
                    png: "roman/images/profile.png",
                }
            }
        };

        try {
            const response = await fetch(`${API_URL}/api/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newComment)
            });
            
            if (!response.ok) throw new Error('Failed to add comment');
            
            // Clear the appropriate textarea
            if (parentId) {
                // For replies
                const replyInput = getElement(".reply-input .cmnt-input");
                if (replyInput) replyInput.value = "";
            } else {
                // For main comments
                if (commentTextarea) commentTextarea.value = "";
            }
            
            await loadData();
            await initComments();
            createPopup("Comment added successfully", "success");
        } catch (error) {
            createPopup(`Failed to add comment: ${error.message}`, "error");
        }
    };

    const promptDel = async (commentObject) => {
        try {
            const modalWrp = getElement(".modal-wrp");
            if (!modalWrp) return;

            modalWrp.classList.remove("invisible");
            const yesButton = modalWrp.querySelector(".yes");
            const noButton = modalWrp.querySelector(".no");

            const cleanup = () => {
                yesButton.removeEventListener('click', handleYes);
                noButton.removeEventListener('click', handleNo);
            };

            const handleYes = async () => {
                try {
                    const response = await fetch(`${API_URL}/api/comments/${commentObject._id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (!response.ok) throw new Error('Failed to delete comment');
                    modalWrp.classList.add("invisible");
                    await loadData();
                    await initComments();
                    createPopup("Comment deleted successfully", "success");
                } catch (error) {
                    createPopup("Failed to delete comment: " + error.message, "error");
                } finally {
                    cleanup();
                }
            };

            const handleNo = () => {
                modalWrp.classList.add("invisible");
                cleanup();
            };

            yesButton.addEventListener('click', handleYes);
            noButton.addEventListener('click', handleNo);
        } catch (error) {
            createPopup("Error showing delete confirmation", "error");
        }
    };

    const spawnReplyInput = (parent, parentId, replyTo = undefined) => {
        if (!currentUser) {
            createPopup("Please log in to reply", "error");
            return;
        }

        getAllElements(".reply-input:not(.main-input)").forEach(input => input.remove());
        
        const inputTemplate = getElement(".reply-input-template");
        if (!inputTemplate) return;

        const inputNode = inputTemplate.content.cloneNode(true);
        const addedInput = appendFrag(inputNode, parent);

        const replyButton = addedInput.querySelector(".bu-primary");
        if (replyButton) {
            replyButton.addEventListener("click", async () => {
                const commentBody = addedInput.querySelector(".cmnt-input").value;
                if (!commentBody) return;

                try {
                    await addComment(commentBody, parentId, replyTo);
                    addedInput.remove();
                } catch (error) {
                    createPopup("Failed to add reply: " + error.message, "error");
                }
            });
        }

        const input = addedInput.querySelector(".cmnt-input");
        if (input) input.focus();
    };

    const handleVote = async (commentId, type) => {
        if (!currentUser) {
            createPopup("Please log in to vote", "error");
            return;
        }

        try {
            console.log('Voting for comment:', commentId, type); // Debug log

            const response = await fetch(`${API_URL}/api/comments/${commentId}/vote`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update vote');
            }
            
            await loadData();
            await initComments();
            createPopup(`Vote ${type}dated successfully`, "success");
        } catch (error) {
            console.error('Vote error:', error); // Debug log
            createPopup(`Failed to update vote: ${error.message}`, "error");
        }
    };

    const createCommentNode = (commentObject) => {
        const commentTemplate = getElement(".comment-template");
        const commentNode = commentTemplate.content.cloneNode(true);
        const comment = commentNode.querySelector(".comment");

        commentNode.querySelector(".usr-name").textContent = commentObject.user.username;
        commentNode.querySelector(".usr-img").src = commentObject.user.image.png;
        commentNode.querySelector(".score-number").textContent = commentObject.score || 0;
        
        // Format the timestamp
        const timestamp = new Date(commentObject.createdAt);
        const formattedDate = timestamp.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        commentNode.querySelector(".cmnt-at").textContent = formattedDate;
        
        const contentElement = commentNode.querySelector(".c-body");
        contentElement.textContent = commentObject.content;

        const replyButton = commentNode.querySelector(".reply");
        if (replyButton) {
            replyButton.addEventListener("click", () => {
                const parentElement = commentNode.querySelector(".replies") || commentNode.parentElement;
                spawnReplyInput(parentElement, commentObject._id, commentObject.user.username);
            });
        }

        if (currentUser && commentObject.user.username === currentUser.username) {
            comment.classList.add("this-user");

            const deleteButton = commentNode.querySelector(".delete");
            if (deleteButton) {
                deleteButton.addEventListener("click", () => promptDel(commentObject));
            }

            const editButton = commentNode.querySelector(".edit");
            if (editButton && contentElement) {
                editButton.addEventListener("click", async () => {
                    const isEditing = contentElement.isContentEditable;
                    contentElement.contentEditable = !isEditing;
                    editButton.textContent = isEditing ? "Edit" : "Save";

                    if (isEditing) {
                        try {
                            const response = await fetch(`${API_URL}/api/comments/${commentObject._id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ content: contentElement.textContent })
                            });
                            
                            if (!response.ok) throw new Error('Failed to update comment');
                            await loadData();
                            await initComments();
                            createPopup("Comment updated successfully", "success");
                        } catch (error) {
                            createPopup("Failed to update comment", "error");
                            contentElement.textContent = commentObject.content;
                        }
                    }
                });
            }
        }

        // Add vote functionality with debug logs
        const scoreElement = commentNode.querySelector(".score-number");
        const upvoteButton = commentNode.querySelector(".score-plus");
        const downvoteButton = commentNode.querySelector(".score-minus");

        scoreElement.textContent = commentObject.score || 0;

        if (upvoteButton) {
            upvoteButton.addEventListener("click", async () => {
                if (!currentUser) {
                    createPopup("Please log in to vote", "error");
                    return;
                }
                console.log('Upvoting comment:', commentObject); // Debug log
                await handleVote(commentObject._id, 'up');
            });
        }

        if (downvoteButton) {
            downvoteButton.addEventListener("click", async () => {
                if (!currentUser) {
                    createPopup("Please log in to vote", "error");
                    return;
                }
                console.log('Downvoting comment:', commentObject); // Debug log
                await handleVote(commentObject._id, 'down');
            });
        }

        // Add hide replies button functionality
        const hideRepliesBtn = commentNode.querySelector(".hide-replies-btn");
        const repliesSection = commentNode.querySelector(".replies");
        
        hideRepliesBtn.style.display = 'none';
        
        const hasReplies = finalData.comments.some(reply => reply.parent === commentObject._id);
        
        if (hasReplies) {
            hideRepliesBtn.style.display = 'block';
            repliesSection.style.display = 'none';
            hideRepliesBtn.textContent = 'Show Replies';
            
            hideRepliesBtn.addEventListener('click', () => {
                const isHidden = repliesSection.style.display === 'none';
                repliesSection.style.display = isHidden ? 'block' : 'none';
                hideRepliesBtn.textContent = isHidden ? 'Hide Replies' : 'Show Replies';
            });
        }

        return commentNode;
    };

    const appendComment = (parentNode, commentNode, parentId) => {
        const appendedCmnt = appendFrag(commentNode, parentNode);
        const replyButton = appendedCmnt.querySelector(".reply");
        
        if (replyButton) {
            const replyTo = appendedCmnt.querySelector(".usr-name").textContent;
            replyButton.addEventListener("click", () => {
                if (parentNode.classList.contains("replies")) {
                    spawnReplyInput(parentNode, parentId, replyTo);
                } else {
                    const repliesSection = appendedCmnt.querySelector(".replies");
                    if (repliesSection) {
                        spawnReplyInput(repliesSection, parentId, replyTo);
                    }
                }
            });
        }
    };

    async function initComments(commentList = null, parent = commentsWrapper) {
        try {
            if (!commentList) {
                const data = await loadData();
                commentList = data.comments.filter(comment => comment.parent === 0);
            }

            parent.innerHTML = "";
            for (const comment of commentList) {
                const commentNode = createCommentNode(comment);
                if (commentNode) {
                    const repliesContainer = commentNode.querySelector(".replies");
                    if (repliesContainer) {
                        const replies = finalData.comments.filter(reply => reply.parent === comment._id);
                        if (replies.length) await initComments(replies, repliesContainer);
                    }
                    appendComment(parent, commentNode, comment._id);
                }
            }
        } catch (error) {
            createPopup("Error initializing comments", "error");
        }
    }

    // Auth handlers
    loginButton.addEventListener("click", () => {
        const username = loginUsernameInput.value.trim();
        if (!username) {
            createPopup("Please enter a valid username", "error");
            return;
        }

        currentUser = {
            username,
            image: { png: "./roman/images/profile.png" }
        };
        
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        loginUsernameInput.value = "";
        updateLoginStatus();
        createPopup(`Logged in as ${username}`, "success");
        
        // Refresh the page after a brief delay to show the popup
        setTimeout(() => {
            window.location.reload();
        }, 500);
    });

    logoutButton.addEventListener("click", () => {
        localStorage.removeItem('currentUser');
        currentUser = null;
        updateLoginStatus();
        createPopup("Successfully logged out", "success");
        
        // Refresh the page after a brief delay to show the popup
        setTimeout(() => {
            window.location.reload();
        }, 500);
    });

    const updateLoginStatus = () => {
        const loginStatusIndicator = getElement(".login-status") || (() => {
            const indicator = document.createElement("div");
            indicator.className = "login-status";
            commentsContainer.appendChild(indicator);
            return indicator;
        })();

        if (currentUser) {
            loginStatusIndicator.textContent = `Logged in as ${currentUser.username}`;
            loginStatusIndicator.classList.add('logged-in');
            loginStatusIndicator.classList.remove('logged-out');
            if (commentInputSection) commentInputSection.style.display = "grid";
            if (commentTextarea) commentTextarea.style.display = "block";
            loginUsernameInput.style.display = "none";
            loginButton.style.display = "none";
            logoutButton.style.display = "inline";
        } else {
            loginStatusIndicator.textContent = "Not logged in";
            loginStatusIndicator.classList.add('logged-out');
            loginStatusIndicator.classList.remove('logged-in');
            if (commentInputSection) commentInputSection.style.display = "none";
            if (commentTextarea) commentTextarea.style.display = "none";
            loginButton.style.display = "inline";
            logoutButton.style.display = "none";
            loginUsernameInput.style.display = "inline";
        }
    };

    // Initialize
    const init = async () => {
        await loadData();
        
        // Get the main container
        const commentsContainer = document.querySelector('.interactive-comments');
        
        const existingMainInput = commentsContainer.querySelector('.reply-input.main-input');
        if (existingMainInput) {
            existingMainInput.remove();
        }
        
        // Create main input
        const mainInput = document.createElement('div');
        mainInput.className = 'reply-input container main-input';
        mainInput.innerHTML = `
            <img src="${currentUser?.image?.webp || 'roman/images/profile.png'}" alt="avatar">
            <textarea class="cmnt-input" placeholder="Add a comment..."></textarea>
            <button class="bu-primary">SEND</button>
        `;
        
        const commentsWrapper = commentsContainer.querySelector('.comments-wrp');
        
        if (commentsWrapper) {
            commentsWrapper.parentNode.insertBefore(mainInput, commentsWrapper);
        } else {
            commentsContainer.appendChild(mainInput);
        }

        const textarea = mainInput.querySelector('.cmnt-input');
        const sendButton = mainInput.querySelector('.bu-primary');

        if (sendButton && textarea) {
            sendButton.addEventListener('click', async () => {
                if (!currentUser) {
                    createPopup("Please log in to comment", "error");
                    return;
                }
                
                const commentBody = textarea.value;
                if (!commentBody.trim()) {
                    createPopup("Please enter a comment", "error");
                    return;
                }
                
                try {
                    await addComment(commentBody);
                    textarea.value = ''; 
                } catch (error) {
                    createPopup("Failed to add comment", "error");
                }
            });

            // Add keypress event for Enter
            textarea.addEventListener("keydown", async (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!commentBody.trim()) {
                        createPopup("Please enter a comment", "error");
                        return;
                    }
                    await addComment(textarea.value);
                    textarea.value = '';
                }
            });
        }
        
        await initComments();
        updateLoginStatus();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Test API connection
    fetch(`${API_URL}/api/comments`).catch(() => 
        createPopup("Failed to connect to API", "error")
    );

    if (sendButton && commentTextarea) {
        sendButton.addEventListener("click", async () => {
            console.log('Send button clicked'); 
            if (!currentUser) {
                createPopup("Please log in to comment", "error");
                return;
            }
            
            const commentBody = commentTextarea.value;
            console.log('Comment body:', commentBody); 
            
            if (!commentBody.trim()) {
                createPopup("Please enter a comment", "error");
                return;
            }
            
            try {
                await addComment(commentBody);
            } catch (error) {
                createPopup("Failed to add comment", "error");
            }
        });

        // Add keypress event for Enter
        commentTextarea.addEventListener("keydown", async (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                console.log('Enter pressed'); 
                const commentBody = commentTextarea.value;
                if (!commentBody.trim()) {
                    createPopup("Please enter a comment", "error");
                    return;
                }
                await addComment(commentBody);
            }
        });
    }
})();