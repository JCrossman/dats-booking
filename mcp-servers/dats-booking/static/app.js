/**
 * DATS Authentication - Form Handler
 *
 * Handles form submission and communicates with the Azure Function API.
 * Session ID is passed via URL parameter from the MCP server.
 */

(function () {
  'use strict';

  // DOM Elements
  const form = document.getElementById('login-form');
  const clientIdInput = document.getElementById('client-id');
  const passcodeInput = document.getElementById('passcode');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = submitBtn.querySelector('.btn-text');
  const btnLoading = submitBtn.querySelector('.btn-loading');
  const errorBox = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');
  const retryBtn = document.getElementById('retry-btn');

  // Get session ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('sid') || urlParams.get('session');

  // Validate session ID on page load
  if (!sessionId) {
    showError('This page was opened incorrectly. Please go back to Claude and try again.');
    form.style.display = 'none';
    return;
  }

  // API base URL (same origin for Azure Static Web Apps)
  const API_BASE = '/api';

  /**
   * Show loading state
   */
  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    btnText.style.display = isLoading ? 'none' : 'inline';
    btnLoading.style.display = isLoading ? 'inline-flex' : 'none';

    if (isLoading) {
      btnLoading.innerHTML = '<span class="spinner"></span> Connecting...';
    }

    // Disable inputs during loading
    clientIdInput.disabled = isLoading;
    passcodeInput.disabled = isLoading;
  }

  /**
   * Show error message
   */
  function showError(message) {
    errorText.textContent = message;
    errorBox.style.display = 'block';
    errorBox.focus(); // Announce to screen readers

    // Hide form on fatal errors
    if (message.includes('incorrectly')) {
      form.style.display = 'none';
    }
  }

  /**
   * Hide error message
   */
  function hideError() {
    errorBox.style.display = 'none';
  }

  /**
   * Handle form submission
   */
  async function handleSubmit(event) {
    event.preventDefault();
    hideError();

    const clientId = clientIdInput.value.trim();
    const passcode = passcodeInput.value;

    // Basic validation
    if (!clientId) {
      showError('Please enter your client ID.');
      clientIdInput.focus();
      return;
    }

    if (!passcode) {
      showError('Please enter your passcode.');
      passcodeInput.focus();
      return;
    }

    setLoading(true);

    try {
      // Send credentials to Azure Function
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          clientId: clientId,
          passcode: passcode,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success! Redirect to success page
        window.location.href = '/success.html';
      } else {
        // Show error message
        const errorMessage = data.error || 'Something went wrong. Please try again.';
        showError(errorMessage);
        setLoading(false);

        // Clear passcode on error (keep client ID)
        passcodeInput.value = '';
        passcodeInput.focus();
      }
    } catch (error) {
      console.error('Login error:', error);
      showError('Could not connect. Please check your internet and try again.');
      setLoading(false);
    }
  }

  /**
   * Handle retry button click
   */
  function handleRetry() {
    hideError();
    passcodeInput.value = '';
    clientIdInput.focus();
  }

  // Event listeners
  form.addEventListener('submit', handleSubmit);
  retryBtn.addEventListener('click', handleRetry);

  // Focus first empty field on load
  if (!clientIdInput.value) {
    clientIdInput.focus();
  } else if (!passcodeInput.value) {
    passcodeInput.focus();
  }

  // Prevent accidental form resubmission
  window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
      setLoading(false);
    }
  });
})();
