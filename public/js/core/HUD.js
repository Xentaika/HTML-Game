export class HUDOverlay {
  constructor() {
    this.overlay = document.getElementById('overlay');
    this.startPrompt = document.getElementById('startPrompt');
    this.healthFill = document.getElementById('healthFill');
    this.healthValue = document.getElementById('healthValue');
    this.ammoDisplay = document.getElementById('ammoDisplay');
    this.reloadIndicator = document.getElementById('reloadIndicator');
    this.scoreDisplay = document.getElementById('scoreDisplay');
    this.eventFeed = document.getElementById('eventFeed');
    this.connectionStatus = document.getElementById('connectionStatus');
    this.serverStats = document.getElementById('serverStats');
    this.pingValue = document.getElementById('pingValue');
    this.tickValue = document.getElementById('tickValue');
    this.crosshair = document.getElementById('crosshair');
    this.hitMarker = document.getElementById('hitMarker');

    this.crosshairTimeout = null;
    this.hitMarkerTimeout = null;
    this.hitMarkerHideTimeout = null;
  }

  updatePlayerStats(player) {
    if (!player) {
      return;
    }
    if (this.healthFill) {
      this.healthFill.style.width = `${player.health}%`;
      this.healthFill.style.background =
        player.health > 30
          ? 'linear-gradient(90deg, #38ffb5, #37d3ff)'
          : 'linear-gradient(90deg, #ff784f, #ff356b)';
    }
    if (this.healthValue) {
      this.healthValue.textContent = `${Math.max(0, Math.round(player.health))} HP`;
    }
    if (this.ammoDisplay && player.weapon) {
      this.ammoDisplay.textContent = `${player.weapon.ammo} / ${player.weapon.reserve}`;
    }
    if (this.scoreDisplay) {
      this.scoreDisplay.textContent = player.score;
    }
  }

  toggleStartPrompt(show) {
    if (!this.startPrompt) {
      return;
    }
    if (show) {
      this.startPrompt.classList.remove('hidden');
    } else {
      this.startPrompt.classList.add('hidden');
    }
  }

  setConnectionStatus(message, visible = true) {
    if (!this.connectionStatus) {
      return;
    }
    this.connectionStatus.textContent = message;
    if (visible) {
      this.connectionStatus.classList.remove('hidden');
    } else {
      this.connectionStatus.classList.add('hidden');
    }
  }

  updateServerStats(stats) {
    if (!this.serverStats) {
      return;
    }

    const hasData = Boolean(
      stats && (stats.ping != null || stats.tickRate != null || stats.targetTickRate != null)
    );

    if (!hasData) {
      this.serverStats.classList.add('hidden');
      if (this.pingValue) {
        this.pingValue.textContent = '—';
      }
      if (this.tickValue) {
        this.tickValue.textContent = '—';
      }
      return;
    }

    this.serverStats.classList.remove('hidden');

    if (this.pingValue) {
      this.pingValue.textContent = stats.ping != null ? `${Math.round(stats.ping)} мс` : '—';
    }

    if (this.tickValue) {
      const tickRateText =
        stats.tickRate != null
          ? `${Math.round(stats.tickRate)} тиков/с`
          : stats.targetTickRate != null
          ? `${Math.round(stats.targetTickRate)} тиков/с`
          : '—';
      this.tickValue.textContent = tickRateText;
    }
  }

  setReloadIndicator(visible, message = 'Перезарядка…') {
    if (!this.reloadIndicator) {
      return;
    }
    if (visible) {
      this.reloadIndicator.textContent = message;
      this.reloadIndicator.classList.remove('hidden');
    } else {
      this.reloadIndicator.classList.add('hidden');
    }
  }

  animateCrosshair(state) {
    if (!this.crosshair) {
      return;
    }
    if (state === 'fire') {
      this.crosshair.classList.add('firing');
      clearTimeout(this.crosshairTimeout);
      this.crosshairTimeout = setTimeout(() => this.crosshair.classList.remove('firing'), 90);
    } else if (state === 'hit' || state === 'headshot') {
      this.crosshair.classList.remove('hit', 'headshot');
      this.crosshair.classList.add(state);
      clearTimeout(this.crosshairTimeout);
      this.crosshairTimeout = setTimeout(() => {
        this.crosshair.classList.remove('hit', 'headshot');
      }, 160);
    }
  }

  showHitMarker(headshot = false) {
    if (!this.hitMarker) {
      return;
    }
    this.hitMarker.classList.toggle('headshot', headshot);
    this.hitMarker.classList.remove('hidden');
    this.hitMarker.classList.add('visible');
    clearTimeout(this.hitMarkerTimeout);
    clearTimeout(this.hitMarkerHideTimeout);
    this.hitMarkerTimeout = setTimeout(() => {
      this.hitMarker.classList.remove('visible');
      this.hitMarkerHideTimeout = setTimeout(() => this.hitMarker.classList.add('hidden'), 90);
    }, 120);
  }

  addFeedEntry(text, headshot = false) {
    if (!this.eventFeed) {
      return;
    }
    const entry = document.createElement('div');
    entry.className = `feed-item${headshot ? ' headshot' : ''}`;
    entry.textContent = text;
    this.eventFeed.appendChild(entry);

    const items = this.eventFeed.querySelectorAll('.feed-item');
    if (items.length > 6) {
      items[0].remove();
    }

    setTimeout(() => entry.remove(), 8000);
  }
}
