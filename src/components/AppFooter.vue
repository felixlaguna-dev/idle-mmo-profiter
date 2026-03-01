<script setup lang="ts">
import { ref } from 'vue'

// Get version from package.json
const version = ref('1.0.0')
const currentYear = ref(new Date().getFullYear())
</script>

<template>
  <footer class="app-footer">
    <div class="footer-content">
      <div class="footer-section">
        <p class="footer-text">
          <strong>IdleMMO Profit Calculator</strong> v{{ version }}
        </p>
        <p class="footer-text footer-text-muted">
          A community tool for optimizing your IdleMMO gameplay
        </p>
      </div>

      <div class="footer-section footer-links">
        <a
          href="https://www.idle-mmo.com/"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
          aria-label="Visit IdleMMO official website"
        >
          IdleMMO Official
        </a>
        <span class="footer-separator" aria-hidden="true">•</span>
        <a
          href="https://github.com/felixlaguna/idle-mmo-profiter"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
          aria-label="View source code on GitHub"
        >
          GitHub
        </a>
        <span class="footer-separator" aria-hidden="true">•</span>
        <a
          href="https://github.com/felixlaguna/idle-mmo-profiter/issues"
          target="_blank"
          rel="noopener noreferrer"
          class="footer-link"
          aria-label="Report issues on GitHub"
        >
          Report Issue
        </a>
      </div>

      <div class="footer-section">
        <p class="footer-text footer-text-muted">
          Made with ❤️ by the community © {{ currentYear }}
        </p>
        <p class="footer-text footer-text-muted footer-disclaimer">
          Not affiliated with IdleMMO. All game data and trademarks belong to their respective
          owners.
        </p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  background-color: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  padding: 2rem 2rem 1.5rem;
  margin-top: 2rem;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: center;
  text-align: center;
}

.footer-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.footer-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.5;
  margin: 0;
}

.footer-text-muted {
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.footer-disclaimer {
  font-size: 0.6875rem;
  opacity: 0.6;
}

.footer-links {
  flex-direction: row;
  align-items: center;
  gap: 0.75rem;
}

.footer-link {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-accent);
  text-decoration: none;
  transition: color 0.2s ease-in-out;
}

.footer-link:hover {
  color: var(--accent-primary);
}

.footer-link:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
  border-radius: 0.25rem;
}

.footer-separator {
  color: var(--text-secondary);
  font-size: 0.875rem;
  user-select: none;
}

/* Responsive */
@media (max-width: 767px) {
  .app-footer {
    padding: 1.5rem 1rem 1rem;
  }

  .footer-content {
    gap: 1rem;
  }

  .footer-links {
    flex-wrap: wrap;
    justify-content: center;
  }

  .footer-text,
  .footer-link {
    font-size: 0.8125rem;
  }

  .footer-text-muted {
    font-size: 0.75rem;
  }
}
</style>
