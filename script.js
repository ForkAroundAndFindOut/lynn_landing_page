(function () {
  "use strict";

  var root = document.documentElement;
  var forceReducedMotion =
    new URLSearchParams(window.location.search).get("motion") === "reduce";
  var reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  root.classList.add("js");

  function hasReducedMotion() {
    return forceReducedMotion || reducedMotionQuery.matches;
  }

  function syncReducedMotionClass() {
    root.classList.toggle("motion-reduced", hasReducedMotion());
  }

  syncReducedMotionClass();

  var navToggle = document.querySelector("[data-nav-toggle]");
  var navLinks = document.querySelector("[data-nav-links]");

  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var isOpen = navLinks.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
      navToggle.querySelector(".sr-only").textContent = isOpen
        ? "Close navigation"
        : "Open navigation";
    });

    navLinks.addEventListener("click", function (event) {
      if (event.target.matches("a")) {
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.querySelector(".sr-only").textContent = "Open navigation";
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && navLinks.classList.contains("is-open")) {
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.querySelector(".sr-only").textContent = "Open navigation";
        navToggle.focus();
      }
    });
  }

  var scrollCardTargets = Array.prototype.slice.call(
    document.querySelectorAll("[data-scroll-card]")
  );
  var scrollCardObserver = null;

  function settleCard(target) {
    target.classList.add("is-settled");

    if (scrollCardObserver) {
      scrollCardObserver.unobserve(target);
    }
  }

  function stopScrollCards() {
    root.classList.remove("has-scroll-card");

    if (scrollCardObserver) {
      scrollCardObserver.disconnect();
      scrollCardObserver = null;
    }

    scrollCardTargets.forEach(function (target) {
      target.classList.add("is-settled");
    });
  }

  function startScrollCards() {
    if (
      hasReducedMotion() ||
      !scrollCardTargets.length ||
      !("IntersectionObserver" in window) ||
      scrollCardObserver
    ) {
      return;
    }

    root.classList.add("has-scroll-card");
    scrollCardObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            settleCard(entry.target);
          }
        });
      },
      {
        rootMargin: "0px 0px -6%",
        threshold: 0.16
      }
    );

    scrollCardTargets.forEach(function (target) {
      scrollCardObserver.observe(target);
    });
  }

  function syncScrollCards() {
    syncReducedMotionClass();

    if (hasReducedMotion()) {
      stopScrollCards();
    } else {
      startScrollCards();
    }
  }

  document.addEventListener("focusin", function (event) {
    var target = event.target.closest("[data-scroll-card]");

    if (target) {
      settleCard(target);
    }
  });

  syncScrollCards();
  reducedMotionQuery.addEventListener("change", syncScrollCards);

  var form = document.getElementById("contact-form");
  var submitButton = document.querySelector("[data-form-submit]");
  var formStatus = document.getElementById("form-status");
  var formSummary = document.getElementById("form-error-summary");

  function setFieldError(field, message) {
    var error = document.getElementById(field.id + "-error");
    if (!error) {
      return;
    }

    field.setAttribute("aria-invalid", message ? "true" : "false");
    error.textContent = message || "";
  }

  function validateForm() {
    var requiredFields = [
      {
        field: document.getElementById("name"),
        message: "Enter your name."
      },
      {
        field: document.getElementById("email"),
        message: "Enter a valid work email."
      },
      {
        field: document.getElementById("reason"),
        message: "Choose the kind of support you are exploring."
      }
    ];
    var firstInvalid = null;

    requiredFields.forEach(function (item) {
      var valid = item.field.value.trim() !== "";

      if (item.field.type === "email" && valid) {
        valid = item.field.validity.valid;
      }

      setFieldError(item.field, valid ? "" : item.message);

      if (!valid && !firstInvalid) {
        firstInvalid = item.field;
      }
    });

    if (firstInvalid) {
      formSummary.hidden = false;
      formStatus.textContent = "";
      formStatus.removeAttribute("data-state");
      formSummary.focus();
      return false;
    }

    formSummary.hidden = true;
    return true;
  }

  if (form && submitButton && formStatus && formSummary) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitButton.click();
    });

    form.addEventListener("input", function (event) {
      if (event.target.matches("input, select")) {
        setFieldError(event.target, "");
        formStatus.textContent = "";
        formStatus.removeAttribute("data-state");
      }
    });

    submitButton.addEventListener("click", function () {
      if (!validateForm()) {
        return;
      }

      formStatus.dataset.state = "preview";
      formStatus.textContent =
        "This preview is not connected to a protected submission endpoint. Your details have not been sent.";
    });
  }

  document.querySelectorAll(".faq-item button").forEach(function (button) {
    button.addEventListener("click", function () {
      var panel = document.getElementById(button.getAttribute("aria-controls"));
      var expanded = button.getAttribute("aria-expanded") === "true";

      button.setAttribute("aria-expanded", String(!expanded));
      panel.hidden = expanded;
    });
  });

  var carousel = document.querySelector("[data-service-carousel]");

  if (carousel) {
    var slides = Array.prototype.slice.call(
      carousel.querySelectorAll("[data-service-slide]")
    );
    var previousButton = carousel.querySelector("[data-service-prev]");
    var nextButton = carousel.querySelector("[data-service-next]");
    var pauseButton = carousel.querySelector("[data-service-pause]");
    var status = carousel.querySelector("[data-service-status]");
    var currentIndex = 0;
    var isTransitioning = false;
    var userPaused = false;
    var autoTimer = null;
    var touchStartY = null;

    function announceCurrent() {
      var slide = slides[currentIndex];
      status.textContent =
        "Service " +
        (currentIndex + 1) +
        " of " +
        slides.length +
        ": " +
        slide.getAttribute("data-service-name");
    }

    function applyStaticMode() {
      carousel.classList.add("is-static");
      slides.forEach(function (slide) {
        slide.removeAttribute("data-position");
        slide.removeAttribute("data-state");
        slide.setAttribute("aria-hidden", "false");
      });
      if (previousButton) {
        previousButton.hidden = true;
      }
      if (nextButton) {
        nextButton.hidden = true;
      }
      if (pauseButton) {
        pauseButton.hidden = true;
      }
      window.clearInterval(autoTimer);
      autoTimer = null;
    }

    function setStablePositions() {
      slides.forEach(function (slide, index) {
        var distance = (index - currentIndex + slides.length) % slides.length;
        var position = distance === 0 ? "active" : distance === 1 ? "below" : "above";

        slide.setAttribute("data-position", position);
        slide.removeAttribute("data-state");
        slide.setAttribute("aria-hidden", position === "active" ? "false" : "true");
      });
      announceCurrent();
    }

    function stopAutoplay() {
      window.clearInterval(autoTimer);
      autoTimer = null;
    }

    function startAutoplay() {
      stopAutoplay();

      if (forceReducedMotion || reducedMotionQuery.matches || userPaused) {
        return;
      }

      autoTimer = window.setInterval(function () {
        move(1);
      }, 6500);
    }

    function restoreAnimatedMode() {
      carousel.classList.remove("is-static");
      if (previousButton) {
        previousButton.hidden = false;
      }
      if (nextButton) {
        nextButton.hidden = false;
      }
      if (pauseButton) {
        pauseButton.hidden = false;
      }
      setStablePositions();
      startAutoplay();
    }

    function move(direction) {
      if (
        forceReducedMotion ||
        reducedMotionQuery.matches ||
        isTransitioning ||
        slides.length < 2
      ) {
        return;
      }

      isTransitioning = true;
      stopAutoplay();

      var previousIndex = currentIndex;
      var nextIndex = (currentIndex + direction + slides.length) % slides.length;
      var outgoing = slides[previousIndex];
      var incoming = slides[nextIndex];
      var enteringFromBelow = direction > 0;

      incoming.setAttribute("data-position", enteringFromBelow ? "below" : "above");
      incoming.setAttribute("data-state", "entering");
      incoming.setAttribute("aria-hidden", "false");
      incoming.getBoundingClientRect();

      window.requestAnimationFrame(function () {
        outgoing.setAttribute(
          "data-state",
          enteringFromBelow ? "exit-up" : "exit-down"
        );
        incoming.setAttribute("data-position", "active");
      });

      window.setTimeout(function () {
        currentIndex = nextIndex;
        setStablePositions();
        isTransitioning = false;
        startAutoplay();
      }, 720);
    }

    function togglePause() {
      userPaused = !userPaused;
      pauseButton.setAttribute("aria-pressed", String(userPaused));
      pauseButton.textContent = userPaused ? "Resume motion" : "Pause motion";

      if (userPaused) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    }

    if (forceReducedMotion || reducedMotionQuery.matches) {
      applyStaticMode();
    } else {
      restoreAnimatedMode();
    }

    reducedMotionQuery.addEventListener("change", function (event) {
      if (forceReducedMotion || event.matches) {
        applyStaticMode();
      } else {
        restoreAnimatedMode();
      }
    });

    if (previousButton) {
      previousButton.addEventListener("click", function () {
        move(-1);
      });
    }

    if (nextButton) {
      nextButton.addEventListener("click", function () {
        move(1);
      });
    }

    if (pauseButton) {
      pauseButton.addEventListener("click", togglePause);
    }

    carousel.addEventListener("mouseenter", stopAutoplay);
    carousel.addEventListener("mouseleave", function () {
      if (!userPaused) {
        startAutoplay();
      }
    });
    carousel.addEventListener("focusin", stopAutoplay);
    carousel.addEventListener("focusout", function (event) {
      if (!carousel.contains(event.relatedTarget) && !userPaused) {
        startAutoplay();
      }
    });
    carousel.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      }
    });
    carousel.addEventListener("touchstart", function (event) {
      touchStartY = event.changedTouches[0].clientY;
    }, { passive: true });
    carousel.addEventListener("touchend", function (event) {
      if (touchStartY === null) {
        return;
      }

      var difference = event.changedTouches[0].clientY - touchStartY;
      touchStartY = null;

      if (Math.abs(difference) > 38) {
        move(difference < 0 ? 1 : -1);
      }
    }, { passive: true });
  }

  var testimonialTrack = document.querySelector("[data-testimonial-track]");
  var testimonialPrevious = document.querySelector("[data-testimonial-prev]");
  var testimonialNext = document.querySelector("[data-testimonial-next]");

  function scrollTestimonials(direction) {
    if (!testimonialTrack) {
      return;
    }

    testimonialTrack.scrollBy({
      left: direction * testimonialTrack.clientWidth * 0.84,
      behavior: motionQueryForTestimonials() ? "auto" : "smooth"
    });
  }

  function motionQueryForTestimonials() {
    return forceReducedMotion || reducedMotionQuery.matches;
  }

  if (testimonialPrevious) {
    testimonialPrevious.addEventListener("click", function () {
      scrollTestimonials(-1);
    });
  }

  if (testimonialNext) {
    testimonialNext.addEventListener("click", function () {
      scrollTestimonials(1);
    });
  }
}());
