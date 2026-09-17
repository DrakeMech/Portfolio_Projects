document.addEventListener('DOMContentLoaded', function () {
    const name = document.querySelector('.name');
    const logo = document.querySelector('.logo');
    const menuBtnDivs = document.querySelectorAll('.menuBtn div');
    const imageCover = document.querySelector('.imageCover');
    let buttonBackgroundColor = '#FFF'; // Default background color for menu buttons'
    const viewportWidth = document.documentElement.clientWidth;
    // Scroll effect for menu
    if (name && logo && imageCover) {
        window.addEventListener('scroll', function () {
            const isScrolledPastHero = window.scrollY > imageCover.offsetHeight - 100;

            // Change the opacity of the name and logo based on the scroll position
            const opacity = isScrolledPastHero ? 0 : 1;
            name.style.opacity = logo.style.opacity = opacity;

            // Change the background color of the menu buttons based on the scroll position and viewport width
            if (viewportWidth >= 480) {
                buttonBackgroundColor = isScrolledPastHero ? '#e7e7e7' : '#FFF';
            } else if (viewportWidth < 480) {
                buttonBackgroundColor = '#2c2c2c';
            }
            menuBtnDivs.forEach(btnDiv => {
                btnDiv.style.background = buttonBackgroundColor;
            });
        });
    }

    const moreInfoButton = document.querySelector('.moreInfoButton');
    const moreInfo = document.getElementById('moreInfo');
    if (moreInfoButton && moreInfo) {
        moreInfoButton.addEventListener('click', function () {
            const isOpen = moreInfo.classList.toggle('open');
            moreInfoButton.textContent = isOpen ? 'LESS INFO' : 'MORE INFO';
            moreInfoButton.setAttribute('aria-expanded', String(isOpen));
        });

        // window.addEventListener('scroll', function () {
        //     const rect = moreInfoButton.getBoundingClientRect();
        //     if (rect.top <= 60) {
        //         moreInfoButton.classList.add('stuck');
        //     } else {
        //         moreInfoButton.classList.remove('stuck');
        //     }
        // });
    }
});

// have to look this up
        function openProject(projectUrl, projectName, projectDescription) {
            sessionStorage.setItem('projectUrl', projectUrl);
            sessionStorage.setItem('projectName', projectName);
            sessionStorage.setItem('projectDescription', projectDescription);
            window.location.href = 'project-detail.html';
        }

         function openProjectMain(projectUrl, projectName) {
            sessionStorage.setItem('projectUrl', projectUrl);
            sessionStorage.setItem('projectName', projectName);
            window.location.href = 'project-detailMain.html';
        }

        // Dots and center-snap handler (Using the IIFE to execute it right away)
        (function(){
            const cover = document.querySelector('.projectsGridCover');
            const dotsContainer = document.querySelector('.heroDots');
            if(!cover || !dotsContainer) return;

            const cards = Array.from(cover.querySelectorAll('.projectCard'));
            cards.forEach((c,i)=>{
                const d = document.createElement('div');
                d.className = 'dot';
                d.dataset.index = i;
                d.addEventListener('click', ()=>{
                    const card = cards[i];
                    if(card) card.scrollIntoView({behavior:'smooth', inline:'center'});
                });
                dotsContainer.appendChild(d);
            });

            const dotElems = Array.from(dotsContainer.children);

            const io = new IntersectionObserver((entries)=>{
                entries.forEach(entry=>{
                    const idx = cards.indexOf(entry.target);
                    if(idx === -1) return;
                    if(entry.intersectionRatio > 0.5){
                        dotElems.forEach(d=>d.classList.remove('active'));
                        dotElems[idx].classList.add('active');
                    }
                });
            }, {root: cover, threshold: [0.5]});

            cards.forEach(c=> io.observe(c));

            if(dotElems[0]) dotElems[0].classList.add('active');
        })();