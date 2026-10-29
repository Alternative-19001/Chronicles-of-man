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
(function () {
    let db;
    let finalData = { comments: [] };
    let currentUser = null;

    // DOM Elements
    const commentsContainer = document.querySelector(".interactive-comments");
    const getElement = (selector) => document.querySelector(selector);
    const getAllElements = (selector) =>
        commentsContainer.querySelectorAll(selector);

    const loginUsernameInput = document.querySelector("#login-username");
    const loginButton = document.querySelector("#login-btn");
    const logoutButton = getElement("#logout-btn");
    const commentInputSection = getElement("#comment-input-section");
    const commentTextarea = getElement(".reply-input .cmnt-input");
    const commentsWrapper = getElement(".comments-wrp");
    const sendButton = getElement(".reply-input .bu-primary");
    
    // Wait for Firebase to load
    function setupFirebase() {
        if (window.db) {
            db = window.db;
            init();
        } else {
            document.addEventListener('firebaseLoaded', () => {
                db = window.db;
                init();
            });
        }
    }
    
    // Load data from Firestore
    async function loadData() {
        try {
            if (!db) {
                console.error("Firebase not initialized");
                return { comments: [] };
            }
            
            const commentsSnapshot = await firebase.firestore().collection("comments").get();
            const commentsData = [];
            
            commentsSnapshot.forEach((doc) => {
                const data = doc.data();
                commentsData.push({
                    _id: doc.id,
                    ...data
                });
            });
            
            finalData = { comments: commentsData };
            console.log("Loaded comments:", finalData);
            return finalData;
        } catch (error) {
            console.error("Error loading comments:", error);
            createPopup("Failed to load comments", "error");
            return { comments: [] };
        }
    }
    
    // Utility to create popup notifications
    function createPopup(message, type = "info") {
        const popup = document.createElement("div");
        popup.className = `popup ${type}`;
        popup.textContent = message;
        
        document.body.appendChild(popup);
        
        setTimeout(() => {
            popup.classList.add("show");
            
            setTimeout(() => {
                popup.classList.remove("show");
                setTimeout(() => popup.remove(), 300);
            }, 3000);
        }, 100);
    }
    
    // Utility to append fragment
    function appendFrag(frag, parent) {
        // Store the insertion point
        const insertedElement = frag.firstElementChild;
        
        // Append the fragment to the parent
        parent.appendChild(frag);
        
        // Return the actual DOM element that was inserted
        // Looking for the last child if we have the correct reference, 
        // otherwise search in the parent for our inserted element
        return parent.lastElementChild || parent.querySelector(`[data-id="${insertedElement?.dataset?.id}"]`);
    }
    
    // Add a comment to Firestore
    async function addComment(content, parentId = 0, replyingTo = null) {
        if (!currentUser) {
            createPopup("Please log in to comment", "error");
            return;
        }
        
        try {
            const commentData = {
                content,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                parent: parentId,
                score: 0,
                user: {
                    username: currentUser.username,
                    image: {
                        png: "roman/images/profile.png"
                    }
                }
            };
            
            if (replyingTo) {
                commentData.replyingTo = replyingTo;
            }
            
            const docRef = await firebase.firestore().collection("comments").add(commentData);
            console.log("Comment added with ID:", docRef.id);
            createPopup("Comment added successfully", "success");
            
            await loadData();
            await initComments();
        } catch (error) {
            console.error("Error adding comment:", error);
            createPopup("Failed to add comment", "error");
        }
    }
    
    // Handle voting
    async function handleVote(commentId, voteType) {
        try {
            const commentRef = firebase.firestore().collection("comments").doc(commentId);
            const commentDoc = await commentRef.get();
            
            if (!commentDoc.exists) {
                createPopup("Comment not found", "error");
                return;
            }
            
            const commentData = commentDoc.data();
            let newScore = commentData.score || 0;
            
            if (voteType === "up") {
                newScore += 1;
            } else if (voteType === "down") {
                newScore = Math.max(0, newScore - 1);
            }
            
            await commentRef.update({ score: newScore });
            console.log(`Vote ${voteType} applied to comment ${commentId}, new score: ${newScore}`);
            
            await loadData();
            await initComments();
        } catch (error) {
            console.error("Error voting:", error);
            createPopup("Failed to vote", "error");
        }
    }
    
    // Delete comment prompt
    function promptDel(comment) {
        if (confirm(`Are you sure you want to delete this comment?`)) {
            deleteComment(comment._id);
        }
    }
    
    // Delete comment
    async function deleteComment(commentId) {
        try {
            await firebase.firestore().collection("comments").doc(commentId).delete();
            console.log(`Comment ${commentId} deleted`);
            createPopup("Comment deleted", "success");
            
            await loadData();
            await initComments();
        } catch (error) {
            console.error("Error deleting comment:", error);
            createPopup("Failed to delete comment", "error");
        }
    }
    
    // Initialize current user from localStorage
    try {
        const savedUser = localStorage.getItem("currentUser");
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            // Update any old image paths to the new one
            if (currentUser.image?.png?.includes("user-image-with-black-background-svgrepo-com")) {
                currentUser.image.png = "roman/images/profile.png";
                localStorage.setItem("currentUser", JSON.stringify(currentUser));
            }
        }
    } catch (error) {
        console.error("Error loading user from localStorage:", error);
    }
    
    const createCommentNode = (commentData) => {
        try {
            const commentTemplate = getElement(".comment-template");
            if (!commentTemplate) {
                console.error("Comment template not found");
                return null;
            }

            const commentNode = commentTemplate.content.cloneNode(true);
            if (!commentNode) {
                console.error("Failed to clone comment template");
                return null;
            }

            const commentElement = commentNode.querySelector(".comment");
            if (!commentElement) {
                console.error("Comment element not found in template clone");
                return null;
            }
            
            // Add a unique data-id to help with finding the element after append
            commentElement.dataset.id = `comment-${commentData._id || Date.now()}`;

            // Set username with error handling
            const usernameElement = commentNode.querySelector(".usr-name");
            if (usernameElement && commentData.user && commentData.user.username) {
                usernameElement.textContent = commentData.user.username;
            } else {
                console.warn("Failed to set username", commentData);
            }

            // Set user image with error handling
            const userImageElement = commentNode.querySelector(".usr-img");
            if (userImageElement && commentData.user && commentData.user.image && commentData.user.image.png) {
                userImageElement.src = commentData.user.image.png;
            }

            // Set score with error handling
            const scoreElement = commentNode.querySelector(".score-number");
            if (scoreElement) {
                scoreElement.textContent = commentData.score || 0;
            }

            // Format the timestamp
            let formattedDate = "Just now";
            if (commentData.createdAt) {
                if (commentData.createdAt.toDate) {
                    // It's a Firestore timestamp
                    formattedDate = commentData.createdAt.toDate().toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    });
                } else if (commentData.createdAt.seconds) {
                    // It's a serialized Firestore timestamp
                    formattedDate = new Date(commentData.createdAt.seconds * 1000).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    });
                } else {
                    // Try as a regular date string
                    const date = new Date(commentData.createdAt);
                    if (!isNaN(date)) {
                        formattedDate = date.toLocaleString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                        });
                    }
                }
            }
            
            const timeElement = commentNode.querySelector(".cmnt-at");
            if (timeElement) {
                timeElement.textContent = formattedDate;
            }

            const contentElement = commentNode.querySelector(".c-body");
            if (contentElement && commentData.content) {
                contentElement.textContent = commentData.content;
            }

            // Initially hide all control buttons
            const deleteButton = commentNode.querySelector(".delete");
            const editButton = commentNode.querySelector(".edit");
            const replyButton = commentNode.querySelector(".reply");
            
            // Only show reply button if user is logged in (handled by CSS)
            if (replyButton) {
                replyButton.addEventListener("click", () => {
                    if (!currentUser) {
                        createPopup("Please log in to reply", "error");
                        return;
                    }
                    
                    // Add pulse animation
                    replyButton.classList.add("reply-pulse");
                    
                    // Remove animation class after it completes
                    setTimeout(() => {
                        replyButton.classList.remove("reply-pulse");
                    }, 300);
                    
                    const parentElement =
                        commentNode.querySelector(".replies") ||
                        commentNode.parentElement;
                    
                    // Pass the reply button to spawnReplyInput
                    spawnReplyInput(
                        parentElement,
                        commentData._id,
                        commentData.user.username,
                        replyButton
                    );
                });
            }

            // Only show edit/delete for user's own comments
            if (
                currentUser &&
                commentData.user && 
                commentData.user.username === currentUser.username
            ) {
                commentElement.classList.add("this-user");

                if (deleteButton) {
                    deleteButton.addEventListener("click", () =>
                        promptDel(commentData),
                    );
                }

                if (editButton && contentElement) {
                    editButton.addEventListener("click", async () => {
                        const isEditing = contentElement.isContentEditable;
                        contentElement.contentEditable = !isEditing;
                        editButton.textContent = isEditing ? "Edit" : "Save";

                        if (isEditing) {
                            try {
                                await firebase.firestore().collection("comments").doc(commentData._id).update({
                                    content: contentElement.textContent
                                });
                                
                                await loadData();
                                await initComments();
                                createPopup("Comment updated successfully", "success");
                            } catch (error) {
                                console.error("Error updating comment:", error);
                                createPopup("Failed to update comment", "error");
                                contentElement.textContent = commentData.content;
                            }
                        }
                    });
                }
            }

            // Add vote functionality with debug logs
            const scoreNumberElement = commentNode.querySelector(".score-number");
            const upvoteButton = commentNode.querySelector(".score-plus");
            const downvoteButton = commentNode.querySelector(".score-minus");

            if (scoreNumberElement) {
                scoreNumberElement.textContent = commentData.score || 0;
            }

            if (upvoteButton) {
                upvoteButton.addEventListener("click", async () => {
                    if (!currentUser) {
                        createPopup("Please log in to vote", "error");
                        return;
                    }
                    console.log("Upvoting comment:", commentData); // Debug log
                    await handleVote(commentData._id, "up");
                });
            }

            if (downvoteButton) {
                downvoteButton.addEventListener("click", async () => {
                    if (!currentUser) {
                        createPopup("Please log in to vote", "error");
                        return;
                    }
                    console.log("Downvoting comment:", commentData); // Debug log
                    await handleVote(commentData._id, "down");
                });
            }

            // Add hide replies button functionality
            const hideRepliesBtn = commentNode.querySelector(".hide-replies-btn");
            const repliesSection = commentNode.querySelector(".replies");

            if (hideRepliesBtn) {
                hideRepliesBtn.style.display = "none";
            }

            if (finalData.comments && finalData.comments.length > 0) {
                const hasReplies = finalData.comments.some(
                    (reply) => reply.parent === commentData._id,
                );

                if (hasReplies && hideRepliesBtn && repliesSection) {
                    hideRepliesBtn.style.display = "block";
                    repliesSection.style.display = "none";
                    hideRepliesBtn.textContent = "Show Replies";

                    hideRepliesBtn.addEventListener("click", () => {
                        const isHidden = repliesSection.style.display === "none";
                        
                        if (isHidden) {
                            // Prepare for animation
                            repliesSection.style.opacity = "0";
                            repliesSection.style.display = "block";
                            repliesSection.style.maxHeight = "0";
                            
                            // Force a reflow to ensure the browser recognizes the changes
                            void repliesSection.offsetWidth;
                            
                            // Add animation class
                            repliesSection.classList.add("animating");
                            hideRepliesBtn.textContent = "Hide Replies";
                            
                            // Remove animation class after animation completes
                            setTimeout(() => {
                                repliesSection.classList.remove("animating");
                                repliesSection.style.opacity = "";
                                repliesSection.style.maxHeight = "";
                            }, 500); // Match the animation duration
                        } else {
                            // Hide replies with a brief fade out
                            repliesSection.style.opacity = "0";
                            repliesSection.style.transform = "translateY(-10px)";
                            
                            setTimeout(() => {
                                repliesSection.style.display = "none";
                                repliesSection.style.opacity = "";
                                repliesSection.style.transform = "";
                                hideRepliesBtn.textContent = "Show Replies";
                            }, 200);
                        }
                    });
                }
            }

            return commentNode;
        } catch (error) {
            console.error("Error creating comment node:", error, commentData);
            return null;
        }
    };

    // Spawn a reply input field
    function spawnReplyInput(parent, parentId, replyTo, replyButton) {
        // Remove any existing reply inputs
        const existingInputs = document.querySelectorAll(".reply-input:not(.main-input)");
        existingInputs.forEach(input => input.remove());
        
        const replyInput = document.createElement("div");
        replyInput.className = "reply-input container";
        replyInput.innerHTML = `
            <img src="${currentUser?.image?.png || "roman/images/profile.png"}" alt="User Avatar" class="usr-img">
            <textarea class="cmnt-input" placeholder="Reply to @${replyTo}...">@${replyTo} </textarea>
            <button class="bu-primary">REPLY</button>
        `;
        
        parent.appendChild(replyInput);
        const textarea = replyInput.querySelector(".cmnt-input");
        const sendButton = replyInput.querySelector(".bu-primary");
        
        // Focus and place cursor at the end
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
        
        sendButton.addEventListener("click", async () => {
            const commentBody = textarea.value.trim();
            if (!commentBody) {
                createPopup("Please enter a reply", "error");
                return;
            }
            
            await addComment(commentBody, parentId, replyTo);
            replyInput.remove();
        });
        
        // Add keypress event for Enter
        textarea.addEventListener("keydown", async (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const commentBody = textarea.value.trim();
                if (!commentBody) {
                    createPopup("Please enter a reply", "error");
                    return;
                }
                await addComment(commentBody, parentId, replyTo);
                replyInput.remove();
            }
        });
    }

    const appendComment = (parentNode, commentNode, parentId) => {
        // Append the fragment and get a reference to the appended element
        const appendedCmnt = appendFrag(commentNode, parentNode);
        
        // Safety check to ensure we have a valid DOM element
        if (!appendedCmnt || typeof appendedCmnt.querySelector !== 'function') {
            console.error("Failed to append comment properly", parentId);
            return; // Exit early if we don't have a valid element
        }

        const replyButton = appendedCmnt.querySelector(".reply");

        if (replyButton) {
            // Get the username, add error handling
            let replyTo = "";
            const usernameEl = appendedCmnt.querySelector(".usr-name");
            if (usernameEl) {
                replyTo = usernameEl.textContent;
            }

            replyButton.addEventListener("click", () => {
                if (parentNode.classList.contains("replies")) {
                    spawnReplyInput(parentNode, parentId, replyTo, replyButton);
                } else {
                    const repliesSection = appendedCmnt.querySelector(".replies");
                    if (repliesSection) {
                        spawnReplyInput(repliesSection, parentId, replyTo, replyButton);
                    }
                }
            });
        }
    };

    async function initComments(commentList = null, parent = commentsWrapper) {
        try {
            if (!commentList) {
                const data = await loadData();
                commentList = data.comments.filter(
                    (comment) => !comment.parent || comment.parent === 0,
                );
                
                // Sort comments to show newest first (based on createdAt timestamp)
                commentList.sort((a, b) => {
                    if (a.createdAt && b.createdAt) {
                        // Handle Firestore timestamps
                        const aDate = a.createdAt.toDate ? a.createdAt.toDate() : 
                                     (a.createdAt.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt));
                        const bDate = b.createdAt.toDate ? b.createdAt.toDate() : 
                                     (b.createdAt.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt));
                        return bDate - aDate;
                    }
                    return 0;
                });
            }

            if (!parent) {
                console.error("Parent element for comments not found");
                return;
            }

            // Clear the parent container
            parent.innerHTML = "";
            
            if (!commentList || commentList.length === 0) {
                console.log("No comments to display");
                return;
            }

            // Process each comment
            for (const comment of commentList) {
                try {
                    if (!comment || !comment._id) {
                        console.warn("Invalid comment data:", comment);
                        continue;
                    }
                    
                    const commentNode = createCommentNode(comment);
                    
                    if (commentNode) {
                        const repliesContainer = commentNode.querySelector(".replies");
                        
                        if (repliesContainer) {
                            const replies = finalData.comments.filter(
                                (reply) => reply.parent === comment._id,
                            );
                            
                            // Sort replies to show newest first
                            if (replies && replies.length) {
                                replies.sort((a, b) => {
                                    if (a.createdAt && b.createdAt) {
                                        // Handle Firestore timestamps
                                        const aDate = a.createdAt.toDate ? a.createdAt.toDate() : 
                                                    (a.createdAt.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt));
                                        const bDate = b.createdAt.toDate ? b.createdAt.toDate() : 
                                                    (b.createdAt.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt));
                                        return bDate - aDate;
                                    }
                                    return 0;
                                });
                                await initComments(replies, repliesContainer);
                            }
                        }
                        
                        appendComment(parent, commentNode, comment._id);
                    } else {
                        console.warn("Failed to create comment node for:", comment);
                    }
                } catch (commentError) {
                    console.error("Error processing individual comment:", commentError, comment);
                    // Continue with other comments instead of breaking the entire function
                }
            }
        } catch (error) {
            console.error("Error initializing comments:", error);
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
            image: { png: "roman/images/profile.png" }
        };
        
        localStorage.setItem("currentUser", JSON.stringify(currentUser));
        loginUsernameInput.value = "";
        updateLoginStatus();
        createPopup(`Logged in as ${username}`, "success");
        
        // Refresh the page after a brief delay to show the popup
        setTimeout(() => {
            window.location.reload();
        }, 500);
    });

    logoutButton.addEventListener("click", () => {
        localStorage.removeItem("currentUser");
        currentUser = null;
        updateLoginStatus();
        createPopup("Successfully logged out", "success");

        // Refresh the page after a brief delay to show the popup
        setTimeout(() => {
            window.location.reload();
        }, 500);
    });

    const updateLoginStatus = () => {
        // Remove any existing login status indicators
        const existingIndicators = document.querySelectorAll('.login-status');
        existingIndicators.forEach(indicator => indicator.remove());
        
        // Create a new indicator directly on the body
        const loginStatusIndicator = document.createElement("div");
        loginStatusIndicator.className = "login-status";
        document.body.appendChild(loginStatusIndicator);

        if (currentUser) {
            loginStatusIndicator.textContent = `Logged in as ${currentUser.username}`;
            loginStatusIndicator.classList.add("logged-in");
            loginStatusIndicator.classList.remove("logged-out");
            if (commentInputSection) commentInputSection.style.display = "grid";
            if (commentTextarea) commentTextarea.style.display = "block";
            loginUsernameInput.style.display = "none";
            loginButton.style.display = "none";
            logoutButton.style.display = "inline";
        } else {
            loginStatusIndicator.textContent = "Not logged in";
            loginStatusIndicator.classList.add("logged-out");
            loginStatusIndicator.classList.remove("logged-in");
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
        const commentsContainer = document.querySelector(
            ".interactive-comments",
        );
        
        const existingMainInput = commentsContainer.querySelector(
            ".reply-input.main-input",
        );
        if (existingMainInput) {
            existingMainInput.remove();
        }
        
        // Create main input
        const mainInput = document.createElement("div");
        mainInput.className = "reply-input container main-input";
        mainInput.innerHTML = `
            <img src="${currentUser?.image?.png || "roman/images/profile.png"}" alt="User Avatar" class="usr-img">
            <textarea class="cmnt-input" placeholder="Add a comment..."></textarea>
            <button class="bu-primary">SEND</button>
        `;

        const commentsWrapper =
            commentsContainer.querySelector(".comments-wrp");

        if (commentsWrapper) {
            commentsWrapper.parentNode.insertBefore(mainInput, commentsWrapper);
        } else {
            commentsContainer.appendChild(mainInput);
        }

        const textarea = mainInput.querySelector(".cmnt-input");
        const sendButton = mainInput.querySelector(".bu-primary");

        if (sendButton && textarea) {
            sendButton.addEventListener("click", async () => {
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
                    textarea.value = "";
                } catch (error) {
                    createPopup("Failed to add comment", "error");
                }
            });

            // Add keypress event for Enter
            textarea.addEventListener("keydown", async (e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const commentBody = textarea.value;
                    if (!commentBody.trim()) {
                        createPopup("Please enter a comment", "error");
                        return;
                    }
                    await addComment(textarea.value);
                    textarea.value = "";
                }
            });
        }

        await initComments();
        updateLoginStatus();
    };

    // Use DOMContentLoaded or call setupFirebase directly depending on document state
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", setupFirebase);
    } else {
        setupFirebase();
    }
})();