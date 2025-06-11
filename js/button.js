document.querySelectorAll('.menu-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.remove('animate'); 
    void btn.offsetWidth; 
    btn.classList.add('animate'); 
  });
});

document.querySelectorAll('.menu-btn-rex').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.classList.remove('animate-pl'); 
    void btn.offsetWidth; 
    btn.classList.add('animate-pl'); 
  });
});