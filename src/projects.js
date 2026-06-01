import { gsap } from 'gsap';

export const PROJECTS_DATA = [
    { name: "Lollapollaza", year: 2021, img: "/projects/Realistic_4k_photo_of_a_202605312331 (17).jpeg" },
    { name: "Sandman", year: 2022, img: "/projects/Realistic_4k_photo_of_a_202605312331 (16).jpeg" },
    { name: "Burning Man", year: 2023, img: "/projects/Realistic_4k_photo_of_a_202605312331 (15).jpeg" },
    { name: "Casa De Seisto", year: 2023, img: "/projects/Realistic_4k_photo_of_a_202605312331 (14).jpeg" },
    { name: "Sunwave", year: 2023, img: "/projects/Realistic_4k_photo_of_a_202605312331 (13).jpeg" },
    { name: "Ultra", year: 2024, img: "/projects/Realistic_4k_photo_of_a_202605312331 (12).jpeg" },
    { name: "Charity Gala", year: 2024, img: "/projects/Realistic_4k_photo_of_a_202605312331 (11).jpeg" },
    { name: "Carnival Masquerade", year: 2022, img: "/projects/Realistic_4k_photo_of_a_202605312331 (10).jpeg" },
    { name: "La Moreneta", year: 2021, img: "/projects/Realistic_4k_photo_of_a_202605312331 (9).jpeg" },
    { name: "Casablanca", year: 2025, img: "/projects/Realistic_4k_photo_of_a_202605312331 (8).jpeg" },
    { name: "Avant Art Gala", year: 2025, img: "/projects/Realistic_4k_photo_of_a_202605312331 (7).jpeg" },
    { name: "Opulance Gala", year: 2026, img: "/projects/Realistic_4k_photo_of_a_202605312331 (6).jpeg" },
    { name: "Pasionate Gala", year: 2022, img: "/projects/Realistic_4k_photo_of_a_202605312331 (5).jpeg" },
    { name: "Leo Mas Wedding", year: 2023, img: "/projects/Realistic_4k_photo_of_a_202605312331 (4).jpeg" },
    { name: "Metla Films", year: 2020, img: "/projects/Realistic_4k_photo_of_a_202605312331 (3).jpeg" },
    { name: "Greek Mythos Gala", year: 2021, img: "/projects/Realistic_4k_photo_of_a_202605312331 (2).jpeg" },
    { name: "Humble Fans Wedding", year: 2025, img: "/projects/Realistic_4k_photo_of_a_202605312331 (1).jpeg" },
    { name: "Sagen Ross Taylor Wedding", year: 2026, img: "/projects/Realistic_4k_photo_of_a_202605312331.jpeg" },
];

const PROJECTS_PER_ROW = 9;
const TOTAL_ROWS = 10;

let rowStartWidth = 125;
let rowEndWidth = 400;
let expandedRowHeight = 0;

export function initProjects() {
  const container = document.getElementById('projects-grid');
  if (!container) return;

  // 1. Generate DOM
  let html = '';
  for (let r = 0; r < TOTAL_ROWS; r++) {
    const startIndex = (r * 7) % PROJECTS_DATA.length;
    const shiftedProjects = [
      ...PROJECTS_DATA.slice(startIndex),
      ...PROJECTS_DATA.slice(0, startIndex)
    ];
    const rowProjects = shiftedProjects.slice(0, PROJECTS_PER_ROW);

    let rowHtml = '<div class="projects-row">';
    rowProjects.forEach(project => {
      rowHtml += `
        <div class="project-item">
          <div class="project-img">
            <img src="${project.img}" alt="${project.name}" decoding="async" />
          </div>
          <div class="project-info">
            <p>${project.name}</p>
            <p>${project.year}</p>
          </div>
        </div>
      `;
    });
    rowHtml += '</div>';
    html += rowHtml;
  }
  container.innerHTML = html;

  // 2. Setup GSAP logic
  const rows = Array.from(container.querySelectorAll('.projects-row'));
  
  function updateDimensions() {
    const isMobile = window.innerWidth < 1000;
    rowStartWidth = isMobile ? 250 : 125;
    rowEndWidth = isMobile ? 750 : 500;

    const firstRow = rows[0];
    if (!firstRow) return;

    firstRow.style.width = `${rowEndWidth}%`;
    expandedRowHeight = firstRow.offsetHeight;
    firstRow.style.width = "";

    const sectionGap = parseFloat(getComputedStyle(container).gap) || 0;
    const sectionPadding = parseFloat(getComputedStyle(container).paddingTop) || 0;

    const expandedSectionHeight = 
      expandedRowHeight * rows.length + 
      sectionGap * (rows.length - 1) + 
      sectionPadding * 2;

    container.style.height = `${expandedSectionHeight}px`;
  }

  function onScrollUpdate() {
    const scrollY = window.scrollY;
    const viewportHeight = window.innerHeight;

    rows.forEach(row => {
      // Need absolute top based on the container since we are altering transforms or widths
      // Actually getBoundingClientRect().top + window.scrollY gives current position, 
      // but if the heights above are stable it should be ok. 
      // Better to cache initial offsets if possible, but the original used getBoundingClientRect.
      const rect = row.getBoundingClientRect();
      const rowTop = rect.top + scrollY;
      
      // Use the static expandedRowHeight instead of dynamic rect.height to prevent layout thrashing and wobble oscillations
      const rowBottom = rowTop + expandedRowHeight;

      const scrollStart = rowTop - viewportHeight;
      const scrollEnd = rowBottom;

      let progress = (scrollY - scrollStart) / (scrollEnd - scrollStart);
      progress = Math.max(0, Math.min(1, progress));

      const width = rowStartWidth + (rowEndWidth - rowStartWidth) * progress;
      row.style.width = `${width}%`;
    });
  }

  // Initial update
  setTimeout(() => {
    updateDimensions();
    onScrollUpdate();
  }, 100);

  window.addEventListener('resize', () => {
    updateDimensions();
    onScrollUpdate();
  });

  gsap.ticker.add(onScrollUpdate);
}
