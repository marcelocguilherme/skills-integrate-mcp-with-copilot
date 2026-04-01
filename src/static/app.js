document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginForm = document.getElementById("login-form");
  const adminToggle = document.getElementById("admin-toggle");
  const cancelLogin = document.getElementById("cancel-login");
  const teacherLoginPanel = document.getElementById("teacher-login-panel");
  const adminStatus = document.getElementById("admin-status");
  const signupHelp = document.getElementById("signup-help");

  let authToken = sessionStorage.getItem("teacherAuthToken") || "";
  let loggedInTeacher = sessionStorage.getItem("teacherUsername") || "";

  function updateAdminUi() {
    const isLoggedIn = Boolean(authToken);

    signupForm.classList.toggle("hidden", !isLoggedIn);
    signupHelp.classList.toggle("hidden", isLoggedIn);
    teacherLoginPanel.classList.add("hidden");

    adminStatus.textContent = isLoggedIn
      ? `Teacher mode enabled: ${loggedInTeacher}`
      : "Student view only";
    adminStatus.className = isLoggedIn
      ? "admin-status"
      : "admin-status muted-status";
    adminStatus.classList.remove("hidden");

    adminToggle.innerHTML = isLoggedIn
      ? '<span aria-hidden="true">🚪</span>'
      : '<span aria-hidden="true">👤</span>';
    adminToggle.setAttribute(
      "aria-label",
      isLoggedIn ? "Teacher logout" : "Teacher login",
    );
  }

  function getAuthHeaders() {
    return authToken ? { Authorization: `Bearer ${authToken}` } : {};
  }

  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  async function hydrateSession() {
    if (!authToken) {
      updateAdminUi();
      return;
    }

    try {
      const response = await fetch("/auth/session", {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Session expired");
      }

      const session = await response.json();
      loggedInTeacher = session.username;
      sessionStorage.setItem("teacherUsername", loggedInTeacher);
    } catch (error) {
      authToken = "";
      loggedInTeacher = "";
      sessionStorage.removeItem("teacherAuthToken");
      sessionStorage.removeItem("teacherUsername");
    }

    updateAdminUi();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        authToken
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`,
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity,
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity,
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
        },
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch(
        `/auth/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        { method: "POST" },
      );
      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      authToken = result.token;
      loggedInTeacher = result.username;
      sessionStorage.setItem("teacherAuthToken", authToken);
      sessionStorage.setItem("teacherUsername", loggedInTeacher);
      loginForm.reset();
      updateAdminUi();
      fetchActivities();
      showMessage(result.message, "success");
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  adminToggle.addEventListener("click", async () => {
    if (!authToken) {
      teacherLoginPanel.classList.toggle("hidden");
      return;
    }

    try {
      const response = await fetch("/auth/logout", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const result = await response.json();

      authToken = "";
      loggedInTeacher = "";
      sessionStorage.removeItem("teacherAuthToken");
      sessionStorage.removeItem("teacherUsername");
      updateAdminUi();
      fetchActivities();
      showMessage(result.message || "Logged out", "success");
    } catch (error) {
      showMessage("Failed to logout cleanly. Resetting session.", "error");
      authToken = "";
      loggedInTeacher = "";
      sessionStorage.removeItem("teacherAuthToken");
      sessionStorage.removeItem("teacherUsername");
      updateAdminUi();
      fetchActivities();
    }
  });

  cancelLogin.addEventListener("click", () => {
    teacherLoginPanel.classList.add("hidden");
    loginForm.reset();
  });

  // Initialize app
  hydrateSession().then(fetchActivities);
});
