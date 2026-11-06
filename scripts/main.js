/* Shared interactive behavior for the home, About, and Projects pages. */
document.addEventListener('DOMContentLoaded', () => {
  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('.primary-nav');

  // Mobile navigation: toggle the menu and keep its accessible state in sync.
  if (menuButton && navigation) {
    menuButton.addEventListener('click', () => {
      const isOpen = navigation.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
    });
    navigation.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navigation.classList.remove('open');
        menuButton.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Project browser: combine category filters with a search across card text and tags.
  const projectGrid = document.querySelector('[data-project-grid]');
  if (projectGrid) {
    const cards = [...projectGrid.querySelectorAll('[data-project-card]')];
    const filterButtons = [...document.querySelectorAll('[data-project-filter]')];
    const searchInput = document.querySelector('[data-project-search]');
    const resultMessage = document.querySelector('[data-project-results]');
    const emptyState = document.querySelector('[data-project-empty]');
    let activeCategory = 'all';

    // Hide cards that fail either the selected category or the search query.
    const updateVisibleCards = () => {
      const query = searchInput?.value.trim().toLowerCase() ?? '';
      let visibleCount = 0;

      cards.forEach((card) => {
        const matchesCategory = activeCategory === 'all'
          || card.dataset.category === activeCategory;
        const searchableText = `${card.dataset.search ?? ''} ${card.textContent}`.toLowerCase();
        const matchesSearch = searchableText.includes(query);
        const isVisible = matchesCategory && matchesSearch;

        card.hidden = !isVisible;
        if (isVisible) visibleCount += 1;
      });

      if (resultMessage) {
        resultMessage.textContent = `Showing ${visibleCount} of ${cards.length} projects`;
      }
      if (emptyState) emptyState.hidden = visibleCount > 0;
    };

    filterButtons.forEach((button) => {
      button.addEventListener('click', () => {
        activeCategory = button.dataset.projectFilter ?? 'all';

        filterButtons.forEach((filterButton) => {
          const isActive = filterButton === button;
          filterButton.classList.toggle('is-active', isActive);
          filterButton.setAttribute('aria-pressed', String(isActive));
        });

        updateVisibleCards();
      });
    });

    searchInput?.addEventListener('input', updateVisibleCards);
    updateVisibleCards();
  }

  // About page carousel: show a centered photo with partial previews on either side.
  document.querySelectorAll('[data-photo-carousel]').forEach((carousel) => {
    const viewport = carousel.querySelector('[data-photo-track]');
    const rail = carousel.querySelector('[data-photo-rail]');
    const previousButton = carousel.querySelector('[data-photo-prev]');
    const nextButton = carousel.querySelector('[data-photo-next]');
    const pagination = carousel.querySelector('[data-photo-pagination]');

    if (!viewport || !rail || !previousButton || !nextButton || !pagination) return;

    const originalSlides = [...rail.querySelectorAll('.about-photo-slide')];
    if (originalSlides.length < 2) return;

    // Copy the adjacent slides too so the side previews stay identical at a loop boundary.
    const cloneCount = Math.min(2, originalSlides.length);
    const makeClone = (slide) => {
      const clone = slide.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      clone.inert = true;
      clone.querySelectorAll('img').forEach((image) => { image.alt = ''; });
      return clone;
    };
    const leadingClones = originalSlides
      .slice(-cloneCount)
      .reverse()
      .map(makeClone);
    const trailingClones = originalSlides
      .slice(0, cloneCount)
      .map(makeClone);

    rail.prepend(...leadingClones);
    rail.append(...trailingClones);

    // Create a direct-selection button for each original photo.
    const pageButtons = originalSlides.map((_, slideIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label', 'Show photo ' + (slideIndex + 1) + ' of ' + originalSlides.length);
      pagination.append(button);
      return button;
    });

    let index = cloneCount;
    let queuedMoves = 0;
    let isMoving = false;

    const getRealIndex = () => ((index - cloneCount) % originalSlides.length + originalSlides.length) % originalSlides.length;

    // Center the active slide while leaving its neighbors partially visible.
    const positionRail = (animate = true) => {
      const activeSlide = rail.children[index];
      if (!activeSlide) return;

      const offset = activeSlide.offsetLeft - (viewport.clientWidth - activeSlide.clientWidth) / 2;
      if (!animate) rail.style.transition = 'none';
      rail.style.transform = `translate3d(${-offset}px, 0, 0)`;

      if (animate) return;

      // Apply clone-to-original repositioning before restoring the CSS transition.
      // This prevents a visible reverse slide at the loop boundary on touch screens.
      rail.getBoundingClientRect();
      rail.style.removeProperty('transition');
    };

    // Keep the active progress segment in sync with the selected photo.
    const updateControls = () => {
      const activeIndex = getRealIndex();
      pageButtons.forEach((button, buttonIndex) => {
        button.setAttribute('aria-current', String(buttonIndex === activeIndex));
      });
    };

    // Queue rapid input so each requested movement completes in order.
    const move = (amount) => {
      if (isMoving) {
        queuedMoves += amount;
        return;
      }
      index += amount;
      isMoving = true;
      positionRail();
    };

    // Choose the shortest route when a user selects a specific progress segment.
    const goTo = (targetIndex) => {
      const activeIndex = getRealIndex();
      let distance = targetIndex - activeIndex;
      if (distance > originalSlides.length / 2) distance -= originalSlides.length;
      if (distance < -originalSlides.length / 2) distance += originalSlides.length;
      if (distance !== 0) move(distance);
    };

    rail.addEventListener('transitionend', (event) => {
      if (event.target !== rail || event.propertyName !== 'transform') return;

      if (index >= cloneCount + originalSlides.length) {
        index -= originalSlides.length;
        positionRail(false);
      } else if (index < cloneCount) {
        index += originalSlides.length;
        positionRail(false);
      }

      isMoving = false;
      updateControls();
      if (queuedMoves) {
        const queuedAmount = queuedMoves;
        queuedMoves = 0;
        requestAnimationFrame(() => move(queuedAmount));
      }
    });

    // Support arrow buttons, direct selection, keyboard arrows, and touch swipes.
    previousButton.addEventListener('click', () => move(-1));
    nextButton.addEventListener('click', () => move(1));
    pageButtons.forEach((button, buttonIndex) => {
      button.addEventListener('click', () => goTo(buttonIndex));
    });
    viewport.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') move(-1);
      if (event.key === 'ArrowRight') move(1);
    });

    let touchStartX = null;
    viewport.addEventListener('pointerdown', (event) => {
      touchStartX = event.clientX;
    });
    viewport.addEventListener('pointerup', (event) => {
      if (touchStartX === null) return;
      const distance = event.clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(distance) > 40) move(distance < 0 ? 1 : -1);
    });
    viewport.addEventListener('pointercancel', () => { touchStartX = null; });

    // Start on the first photo and recenter it when the viewport changes size.
    updateControls();
    positionRail(false);
    window.addEventListener('resize', () => positionRail(false));
  });

});
