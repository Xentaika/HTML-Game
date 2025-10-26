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

    this.buyClose?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleBuyMenu(false);
      if (typeof this.buyCloseHandler === 'function') {
        this.buyCloseHandler();
      }
    });
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
    this.crosshair.classList.remove('hit', 'headshot', 'fire');
    if (state) {
      this.crosshair.classList.add(state);
    }
    this.crosshair.classList.remove('animate');
    void this.crosshair.offsetWidth;
    this.crosshair.classList.add('animate');
    setTimeout(() => this.crosshair?.classList.remove('animate'), 110);
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
      item.type = 'button';
      item.innerHTML = `<span class="weapon">${definition.name}</span><span class="price">$${definition.price}</span>`;
      item.addEventListener('click', (event) => {
        event.preventDefault();
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
    this.buyMenu.setAttribute('aria-hidden', (!show).toString());
  }

  onBuyClose(callback) {
    this.buyCloseHandler = callback;
  }

  setCrosshairSpread(pixels) {
    if (!this.crosshair) {
      return;
    }
    const clamped = Math.max(4, Math.min(36, pixels));
    this.crosshair.style.setProperty('--spread', `${clamped.toFixed(2)}px`);
  }
}
