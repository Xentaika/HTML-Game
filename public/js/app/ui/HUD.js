import { WeaponDefinitions } from '../data/weapons.js';

export class HUD {
  constructor() {
    this.healthValue = document.getElementById('hudHealthValue');
    this.ammoValue = document.getElementById('hudAmmo');
    this.moneyValue = document.getElementById('hudMoney');
    this.scoreValue = document.getElementById('hudScore');
    this.killFeed = document.getElementById('killFeed');
    this.connectionStatus = document.getElementById('connectionStatus');
    this.buyPrompt = document.getElementById('buyPrompt');
    this.buyMenu = document.getElementById('buyMenu');
    this.buyList = document.getElementById('buyList');
    this.buyClose = document.getElementById('buyClose');
    this.pingValue = document.getElementById('hudPing');
    this.playOverlay = document.getElementById('startOverlay');
    this.playButton = document.getElementById('playButton');
    this.crosshair = document.getElementById('crosshair');
    this.hitMarker = document.getElementById('hitMarker');
    this.crosshairBaseColor = '#f4f5f7';
    this.crosshairResetHandle = null;

    this.buyCloseCallbacks = new Set();
    if (this.buyClose) {
      this.buyClose.addEventListener('click', () => {
        this.toggleBuyMenu(false);
        this.buyCloseCallbacks.forEach((cb) => cb());
      });
    }
  }

  onPlayRequest(callback) {
    if (this.playButton) {
      this.playButton.addEventListener('click', () => {
        callback();
      });
    }
  }

  showPlayOverlay(show) {
    if (!this.playOverlay) {
      return;
    }
    this.playOverlay.classList.toggle('hidden', !show);
  }

  setConnectionStatus(message, isError = false) {
    if (!this.connectionStatus) {
      return;
    }
    this.connectionStatus.textContent = message;
    this.connectionStatus.classList.toggle('error', isError);
    this.connectionStatus.classList.remove('hidden');
  }

  updateHealth(value) {
    if (this.healthValue) {
      this.healthValue.textContent = `${Math.round(value)} HP`;
    }
  }

  updateAmmo({ ammo, reserve }) {
    if (!this.ammoValue) {
      return;
    }
    if (ammo == null) {
      this.ammoValue.textContent = '∞';
    } else {
      this.ammoValue.textContent = `${ammo} / ${reserve ?? 0}`;
    }
  }

  updateMoney(value) {
    if (this.moneyValue) {
      this.moneyValue.textContent = `$${value}`;
    }
  }

  updateScore(value) {
    if (this.scoreValue) {
      this.scoreValue.textContent = value;
    }
  }

  updatePing(value) {
    if (this.pingValue) {
      this.pingValue.textContent = value != null ? `${Math.round(value)} ms` : '—';
    }
  }

  addKillFeed(message, variant = 'default') {
    if (!this.killFeed) {
      return;
    }
    const entry = document.createElement('div');
    entry.className = `feed-entry ${variant}`;
    entry.textContent = message;
    this.killFeed.prepend(entry);
    while (this.killFeed.children.length > 6) {
      this.killFeed.removeChild(this.killFeed.lastChild);
    }
    requestAnimationFrame(() => entry.classList.add('show'));
    setTimeout(() => entry.classList.add('fade'), 3500);
    setTimeout(() => entry.remove(), 4100);
  }

  pulseCrosshair(state) {
    if (!this.crosshair) {
      return;
    }
    const colors = {
      headshot: '#ff6f6f',
      hit: '#9be37d',
      fire: '#fcb86c'
    };
    if (this.crosshairResetHandle) {
      clearTimeout(this.crosshairResetHandle);
    }
    const color = colors[state] ?? this.crosshairBaseColor;
    this.crosshair.style.setProperty('--bar-color', color);
    this.crosshair.classList.remove('animate');
    void this.crosshair.offsetWidth;
    this.crosshair.classList.add('animate');
    this.crosshairResetHandle = setTimeout(() => {
      this.crosshair?.classList.remove('animate');
      this.crosshair?.style.setProperty('--bar-color', this.crosshairBaseColor);
      this.crosshairResetHandle = null;
    }, 140);
  }

  showHitMarker(headshot = false) {
    if (!this.hitMarker) {
      return;
    }
    this.hitMarker.classList.toggle('headshot', headshot);
    this.hitMarker.classList.add('visible');
    setTimeout(() => this.hitMarker.classList.remove('visible'), 120);
  }

  setBuyPrompt(visible) {
    if (this.buyPrompt) {
      this.buyPrompt.classList.toggle('hidden', !visible);
    }
  }

  populateBuyMenu(weaponIds, onSelect) {
    if (!this.buyList) {
      return;
    }
    this.buyList.innerHTML = '';
    weaponIds.forEach((weaponId) => {
      const definition = WeaponDefinitions[weaponId];
      if (!definition) {
        return;
      }
      const item = document.createElement('button');
      item.className = 'buy-item';
      item.innerHTML = `<span class="weapon">${definition.name}</span><span class="price">$${definition.price}</span>`;
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        onSelect(weaponId);
      });
      this.buyList.appendChild(item);
    });
  }

  toggleBuyMenu(show) {
    if (!this.buyMenu) {
      return;
    }
    this.buyMenu.classList.toggle('hidden', !show);
  }

  onBuyClose(callback) {
    if (typeof callback === 'function') {
      this.buyCloseCallbacks.add(callback);
    }
  }

  setCrosshairSpread({ gap, thickness, length, color } = {}) {
    if (!this.crosshair) {
      return;
    }
    if (Number.isFinite(gap)) {
      const clamped = Math.min(Math.max(gap, 6), 28);
      this.crosshair.style.setProperty('--gap', `${clamped.toFixed(2)}px`);
    }
    if (Number.isFinite(thickness)) {
      const clamped = Math.min(Math.max(thickness, 1.6), 4.2);
      this.crosshair.style.setProperty('--bar-thickness', `${clamped.toFixed(2)}px`);
    }
    if (Number.isFinite(length)) {
      const clamped = Math.min(Math.max(length, 10), 22);
      this.crosshair.style.setProperty('--bar-length', `${clamped.toFixed(2)}px`);
    }
    if (color) {
      this.crosshairBaseColor = color;
      if (!this.crosshairResetHandle) {
        this.crosshair.style.setProperty('--bar-color', color);
      }
    }
  }
}
