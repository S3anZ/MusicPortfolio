import { gsap } from 'gsap';
import './BounceCards.css';

export default function initBounceCards(container, {
  images = [],
  containerWidth = 400,
  containerHeight = 400,
  animationDelay = 0.5,
  animationStagger = 0.06,
  easeType = 'elastic.out(1, 0.8)',
  duration = 0.5,
  transformStyles = [
    'rotate(10deg) translate(-170px)',
    'rotate(5deg) translate(-85px)',
    'rotate(-3deg)',
    'rotate(-10deg) translate(85px)',
    'rotate(2deg) translate(170px)'
  ],
  enableHover = true,
  onHover = null,
  onLeave = null,
  onClick = null
} = {}) {
  if (!container) return null;

  // Setup container
  container.classList.add('bounceCardsContainer');
  container.style.position = 'relative';
  container.style.width = typeof containerWidth === 'number' ? `${containerWidth}px` : containerWidth;
  container.style.height = typeof containerHeight === 'number' ? `${containerHeight}px` : containerHeight;

  // Render cards
  container.innerHTML = images.map((src, idx) => {
    const transform = transformStyles[idx] || 'none';
    return `
      <div class="card card-${idx}" style="transform: ${transform}">
        <div class="card-inner" style="transform: scale(0); width: 100%; height: 100%; transform-origin: center;">
          <img class="image" src="${src}" alt="card-${idx}" />
        </div>
      </div>
    `;
  }).join('');

  const cards = container.querySelectorAll('.card');
  const cardInners = container.querySelectorAll('.card-inner');

  // Entrance animation targeting inner wrappers to preserve parent rotate/translate transforms
  gsap.fromTo(
    cardInners,
    { scale: 0 },
    {
      scale: 1,
      stagger: animationStagger,
      ease: easeType,
      delay: animationDelay,
      duration: duration
    }
  );

  const getNoRotationTransform = transformStr => {
    const hasRotate = /rotate\([\s\S]*?\)/.test(transformStr);
    if (hasRotate) {
      return transformStr.replace(/rotate\([\s\S]*?\)/, 'rotate(0deg)');
    } else if (transformStr === 'none') {
      return 'rotate(0deg)';
    } else {
      return `${transformStr} rotate(0deg)`;
    }
  };

  const getPushedTransform = (baseTransform, offsetX) => {
    const translateRegex = /translate\(([-0-9.]+)px\)/;
    const match = baseTransform.match(translateRegex);
    if (match) {
      const currentX = parseFloat(match[1]);
      const newX = currentX + offsetX;
      return baseTransform.replace(translateRegex, `translate(${newX}px)`);
    } else {
      return baseTransform === 'none' ? `translate(${offsetX}px)` : `${baseTransform} translate(${offsetX}px)`;
    }
  };

  const pushSiblings = hoveredIdx => {
    if (!enableHover) return;
    if (onHover) onHover(hoveredIdx);

    const baseWidth = typeof containerWidth === 'number' ? containerWidth : 400;
    const pushDist = Math.round(baseWidth * 0.35);

    images.forEach((_, i) => {
      const target = container.querySelector(`.card-${i}`);
      if (!target) return;
      gsap.killTweensOf(target);

      const baseTransform = transformStyles[i] || 'none';

      if (i === hoveredIdx) {
        const noRotationTransform = getNoRotationTransform(baseTransform);
        gsap.to(target, {
          transform: noRotationTransform,
          duration: 0.4,
          ease: 'back.out(1.4)',
          overwrite: 'auto'
        });
      } else {
        const offsetX = i < hoveredIdx ? -pushDist : pushDist;
        const pushedTransform = getPushedTransform(baseTransform, offsetX);

        const distance = Math.abs(hoveredIdx - i);
        const delay = distance * 0.05;

        gsap.to(target, {
          transform: pushedTransform,
          duration: 0.4,
          ease: 'back.out(1.4)',
          delay,
          overwrite: 'auto'
        });
      }
    });
  };

  const resetSiblings = () => {
    if (!enableHover) return;
    if (onLeave) onLeave();

    images.forEach((_, i) => {
      const target = container.querySelector(`.card-${i}`);
      if (!target) return;
      gsap.killTweensOf(target);
      const baseTransform = transformStyles[i] || 'none';
      gsap.to(target, {
        transform: baseTransform,
        duration: 0.4,
        ease: 'back.out(1.4)',
        overwrite: 'auto'
      });
    });
  };

  // Wire up event listeners
  const listeners = [];
  cards.forEach((card, idx) => {
    const enterHandler = () => pushSiblings(idx);
    const leaveHandler = resetSiblings;
    const clickHandler = () => { if (onClick) onClick(idx); };

    card.addEventListener('mouseenter', enterHandler);
    card.addEventListener('mouseleave', leaveHandler);
    card.addEventListener('click', clickHandler);
    
    // Add cursor pointer if clickable
    if (onClick) {
      card.style.cursor = 'pointer';
    }

    listeners.push({ card, enterHandler, leaveHandler, clickHandler });
  });

  // Return a destroy cleanup function
  return () => {
    listeners.forEach(({ card, enterHandler, leaveHandler, clickHandler }) => {
      card.removeEventListener('mouseenter', enterHandler);
      card.removeEventListener('mouseleave', leaveHandler);
      if (clickHandler) card.removeEventListener('click', clickHandler);
      gsap.killTweensOf(card);
    });
  };
}
