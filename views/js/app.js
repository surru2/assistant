const headers = { 'Content-Type': 'application/json' }


$( document ).ready(async function(){
    let workers = await fetch('/', { method: 'post', headers, body: JSON.stringify({act:'getUsers',id:window.location.pathname.replace('/','')}) })
    workers = await workers.json()
    let tasks = await fetch('/', { method: 'post', headers, body: JSON.stringify({act:'getTasks',id:window.location.pathname.replace('/','')}) })
    tasks = await tasks.json()
    setCards(tasks, workers)
    $(".dropdown-trigger").dropdown();
    $('.datepicker').datepicker({
      default: 'now',
      twelvehour: false,
      autoclose: true,
      vibrate: true,
      format: 'dd.mm.yyyy'
    });
    $('select').formSelect();
    $('.timepicker').timepicker({
      twelveHour: false
    });
})


function setCards(tasks, workers){
  let card=``
  tasks.forEach(task=>{
    card+=`
    <div class="tinder--card" id="${task._id}">
        <h5 class="nodrag" style="text-align:left;padding:10px;">${task.text}</h1>
        <input type="text" class="datepicker control" placeholder="Старт" style="width:20%;">
        <input type="text" class="timepicker control" placeholder="Время" style="width:20%;">
        <input type="text" class="datepicker control" placeholder="Стоп" style="width:20%;">
        <input type="text" class="timepicker control" placeholder="Время" style="width:20%;">
        <div class="input-field" style="padding:10px;">
            <select class="control">
                <option value="" disabled selected>Выберите исполнителя</option>
                <option value="${window.location.pathname.replace('/','')}">Я сам сделаю</option>`
                workers.forEach(user=>{
                  card+=`<option value="${user.id}">${user.first_name} ${user.last_name}</option>`
                })
                card+=`            
            </select>
        </div>
        <div class="input-field" style="padding:10px;">
                <select class="control">
                    <option value="" disabled selected>Выберите важность</option>
                    <option value="1">Низкая</option>
                    <option value="2">Высокая</option>
                    <option value="3">Средняя</option>
                </select>
            </div>
    </div>    
    `
  })
  $('#cards').html(card)
  var tinderContainer = document.querySelector('.tinder');
  var allCards = document.querySelectorAll('.tinder--card');
  var nope = document.getElementById('nope');
  var love = document.getElementById('love');
  initCards();
  function initCards(card, index) {
    var newCards = document.querySelectorAll('.tinder--card:not(.removed)');
  
    newCards.forEach(function (card, index) {
      card.style.zIndex = allCards.length - index;
      card.style.transform = 'scale(' + (20 - index) / 20 + ') translateY(-' + 30 * index + 'px)';
      card.style.opacity = (10 - index) / 10;
    });
    
    tinderContainer.classList.add('loaded');
  }
  
  initCards();
  
  allCards.forEach(function (el) {
  
    var hammertime = new Hammer(el);
  
    hammertime.on('pan', function (event) {
      el.classList.add('moving');
    });
  
    hammertime.on('pan', function (event) {
      if (event.deltaX === 0) return;
      if (event.center.x === 0 && event.center.y === 0) return;
  
      tinderContainer.classList.toggle('tinder_love', event.deltaX > 0);
      tinderContainer.classList.toggle('tinder_nope', event.deltaX < 0);
  
      var xMulti = event.deltaX * 0.03;
      var yMulti = event.deltaY / 80;
      var rotate = xMulti * yMulti;
  
      event.target.style.transform = 'translate(' + event.deltaX + 'px, ' + event.deltaY + 'px) rotate(' + rotate + 'deg)';
    });
  
    hammertime.on('panend', function (event) {
      el.classList.remove('moving');
      tinderContainer.classList.remove('tinder_love');
      tinderContainer.classList.remove('tinder_nope');
  
      var moveOutWidth = document.body.clientWidth;
      var keep = Math.abs(event.deltaX) < 80 || Math.abs(event.velocityX) < 0.5;
  
      event.target.classList.toggle('removed', !keep);
  
      if (keep) {
        event.target.style.transform = '';
      } else {
        var endX = Math.max(Math.abs(event.velocityX) * moveOutWidth, moveOutWidth);
        var toX = event.deltaX > 0 ? endX : -endX;
        var endY = Math.abs(event.velocityY) * moveOutWidth;
        var toY = event.deltaY > 0 ? endY : -endY;
        var xMulti = event.deltaX * 0.03;
        var yMulti = event.deltaY / 80;
        var rotate = xMulti * yMulti;
        event.target.style.transform = 'translate(' + toX + 'px, ' + (toY + event.deltaY) + 'px) rotate(' + rotate + 'deg)';
        initCards();
        if(toX<0){
          toWork(event.target)
        }else{

        }
      }
    });
  });
  
  function toWork(elem){
    console.log(elem)
    const id = elem.id
    const controls = elem.querySelectorAll('.control')
    const startAlarm = $(controls[0]).val() ? $(controls[0]).val() : moment().format('DD.MM.YYYY')
    const startAlarmTime = $(controls[1]).val() ? $(controls[1]).val() : moment().format('HH:mm')
    const stopAlarm = $(controls[2]).val() ? $(controls[2]).val() : moment().format('DD.MM.YYYY')
    const stopAlarmTime = $(controls[3]).val() ? $(controls[3]).val() : moment().format('HH:mm')
    const worker = $(controls[4]).children("option:selected").val() ? $(controls[4]).children("option:selected").val() : window.location.pathname.replace('/','')
    const importance = $(controls[5]).children("option:selected").val() ? $(controls[5]).children("option:selected").val() : 1
    console.log(startAlarm,stopAlarm,worker,importance)
    fetch('/', { 
      method: 'post', 
      headers, 
      body: JSON.stringify({
        act:'setTask',
        id,
        startAlarm,
        stopAlarm,
        startAlarmTime,
        stopAlarmTime,
        worker,
        importance
      }) })
  }

  function createButtonListener(love) {
    return function (event) {
      var cards = document.querySelectorAll('.tinder--card:not(.removed)');
  
      var moveOutWidth = document.body.clientWidth * 1.5;
  
      if (!cards.length) return false;
  
      var card = cards[0];
  
      card.classList.add('removed');
  
      if (love) {
        card.style.transform = 'translate(' + moveOutWidth + 'px, -100px) rotate(-30deg)';
      } else {
        card.style.transform = 'translate(-' + moveOutWidth + 'px, -100px) rotate(30deg)';
      }
  
      initCards();
  
      event.preventDefault();
    };
  }
  
  var nopeListener = createButtonListener(false);
  var loveListener = createButtonListener(true);
  
  nope.addEventListener('click', nopeListener);
  love.addEventListener('click', loveListener);  
}

