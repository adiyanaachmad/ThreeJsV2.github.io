const openSettingBtn = document.getElementById('openSettingBtn');
  const cardWrapper = document.getElementById('cardWrapper');

  let isCardWrapperVisible = false;

  openSettingBtn.addEventListener('click', () => {
    isCardWrapperVisible = !isCardWrapperVisible;

    if (isCardWrapperVisible) {
      cardWrapper.style.opacity = '1';
      cardWrapper.style.pointerEvents = 'auto';
    } else {
      cardWrapper.style.opacity = '0';
      cardWrapper.style.pointerEvents = 'none';
    }
  });