function sideBarOp() {
    const sidebar = document.getElementById('sideBar');
    const main = document.querySelector('main');

    if (sidebar.classList.contains('is-opening')) {
        return;
    }

    sidebar.style.display = 'block';
    sidebar.classList.remove('is-closing', 'is-opening');
    void sidebar.offsetWidth;
    sidebar.classList.add('is-opening');
    main.style.overflow = 'hidden';
}

function sideBarCl() {
    const sidebar = document.getElementById('sideBar');

    if (sidebar.style.display === 'none' || sidebar.classList.contains('is-closing')) {
        return;
    }

    sidebar.classList.remove('is-opening');
    void sidebar.offsetWidth;
    sidebar.classList.add('is-closing');
}

document.addEventListener('animationend', (event) => {
    const sidebar = document.getElementById('sideBar');

    if (event.target !== sidebar) {
        return;
    }

    if (event.animationName === 'sidebar-glitch-in') {
        sidebar.classList.remove('is-opening');
    } else if (event.animationName === 'sidebar-glitch-out' && sidebar.classList.contains('is-closing')) {
        sidebar.classList.remove('is-closing');
        sidebar.style.display = 'none';
        document.querySelector('main').style.overflow = 'auto';
    }
});