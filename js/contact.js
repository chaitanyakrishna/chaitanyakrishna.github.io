// Contact Form Handling for Static Site (via Formspree)
document.addEventListener('DOMContentLoaded', function() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const errorMsg = document.getElementById('error-msg');
      const simpleMsg = document.getElementById('simple-msg');
      const submitBtn = document.getElementById('submit');
      
      // Reset messages
      errorMsg.innerHTML = "";
      simpleMsg.innerHTML = "";
      errorMsg.style.opacity = 0;
      
      // Get Values
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());
      
      // Validation
      if (!data.name || !data.email || !data.subject || !data.message) {
           errorMsg.innerHTML = "<div class='alert alert-warning'>*Please fill all required fields*</div>";
           fadeIn(errorMsg);
           return;
      }

      // UI Loading State
      const originalBtnText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerText = 'Sending...';

      try {
          const response = await fetch(form.action, {
              method: 'POST',
              body: JSON.stringify(data),
              headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
              }
          });

          if (response.ok) {
              simpleMsg.innerHTML = "<div class='alert alert-success'>Message sent successfully! I'll get back to you soon.</div>";
              form.reset();
          } else {
              const result = await response.json();
              if (Object.hasOwn(result, 'errors')) {
                  const messages = result.errors.map(err => err.message).join(", ");
                  errorMsg.innerHTML = `<div class='alert alert-danger'>${messages}</div>`;
              } else {
                  errorMsg.innerHTML = "<div class='alert alert-danger'>Oops! There was a problem submitting your form.</div>";
              }
              fadeIn(errorMsg);
          }
      } catch (error) {
          errorMsg.innerHTML = "<div class='alert alert-danger'>Network error. Please try again later.</div>";
          fadeIn(errorMsg);
          console.error(error);
      } finally {
          submitBtn.disabled = false;
          submitBtn.innerText = originalBtnText;
      }
  });
});

function fadeIn(element) {
  var opacity = 0;
  var intervalID = setInterval(function () {
      if (opacity < 1) {
          opacity = opacity + 0.1;
          element.style.opacity = opacity;
      } else {
          clearInterval(intervalID);
      }
  }, 40);
}