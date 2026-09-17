function sideBarOp() {
    console.log('Opening sidebar');
    document.getElementById('sideBar').style.display = 'block';
    document.querySelector('main').style.overflow = 'hidden';
}

function sideBarCl() {
    console.log('Closing sidebar');
    document.getElementById('sideBar').style.display = 'none';
    document.querySelector('main').style.overflow = 'auto';
}