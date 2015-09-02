angular.module('app', ['doTA'])

.filter('toFixed', function() {
  return function(val, digit) {
    return val.toFixed(digit || 5);
  }
})

.controller('ctrl', function($scope, $filter, doTA) {
  //scrollTop limit: firefox: 6M, IE: 1M, others 32M
  var maxScrollTop = window.mozRequestAnimationFrame ? 6e6 :
    document.documentMode || /Edge/.test(navigator.userAgent) ? 1e6 : 32e6;

  $scope.hasRIC = typeof requestIdleCallback !== 'undefined';
  $scope.hasRAF = typeof requestAnimationFrame !== 'undefined';
  $scope.useWhat = 0;
  $scope.dataType = 0;
  var scrollElem; //keep it for scroll to top later
  var data = [], fixedData = [];

  //scroll handler
  window.virtualScroll = function(elem) {
    scrollElem = elem;
    var scrollTop = elem.scrollTop;
    var scrollLeft = elem.scrollLeft;

    // Find Row Index
    var offsetTop = (((scrollTop * $scope.scale) / $scope.cellHeight) | 0) || 0;
    if (offsetTop + $scope.rows > $scope.dataLength) {
      // console.log('offsetTop over', $scope.offsetTop, scrollTop);
      offsetTop = $scope.dataLength - $scope.rows;
    }
    var realOffsetTop = offsetTop;

    // if ($scope.offsetTop !== offsetTop) {
    if (+$scope.dataType === 1) {
      // console.log('create virtual data', offsetTop, scrollTop);
      makeData($scope.rows, offsetTop, data);
      offsetTop = 0;
    }
    // }

    // Find Column Index
    // console.time('column');
    var offsetLeft = 0, offsetRight = widthMap.length, scrollOffsetLeft = 0;
    for (var i = 0; i < widthMap.length; i++) {
      if (scrollLeft < widthMap[i]) {
        offsetLeft = i;
        scrollOffsetLeft = i ? widthMap[i - 1] : 0;
        for (var j = i; j < widthMap.length; j++) {
          if (scrollLeft + $scope.width <= widthMap[j]) {
            offsetRight = j + 1;
            // console.log('offsetRight', offsetRight, widthMap.length);
            break;
          }
        }
        break;
      }
    }
    // console.timeEnd('column');
    if (offsetRight - offsetLeft  > 7) {
      console.log('offsetTop|offsetLeft/offsetRight', [offsetTop, offsetLeft, offsetRight]);
    }

    // if offsetTop don't change, just return
    // if ( $scope.offsetTop === offsetTop && $scope.scrollLeft === scrollLeft) { return; }

    $scope.realOffsetTop = realOffsetTop;
    $scope.offsetTop = offsetTop
    $scope.offsetLeft = offsetLeft;
    $scope.offsetRight = offsetRight;
    $scope.scrollTop = scrollTop;
    $scope.scrollLeft = scrollLeft;
    $scope.scrollOffsetLeft = scrollOffsetLeft;

    // console.log('useWhat/dataType', [+$scope.useWhat, +$scope.dataType],
    //   'scrollLeft/scrollTop/scrollOffsetLeft', [scrollLeft, offsetTop, scrollOffsetLeft],
    //   'offsetTop/offsetLeft/offsetRight', [offsetTop, offsetLeft, offsetRight]);

    switch (+$scope.useWhat) {
      case 0:
        return patch();
      case 1:
        return requestAnimationFrame(patch);
      case 2:
        return requestIdleCallback(patch);
      case 3:
        return setTimeout(patch);
    }
  };

  //dom patching
  function patch(){
    // console.time('patch');
    compileFn($scope, $filter, 0, 1);
    // console.timeEnd('patch');
  }

  //initialize scope variables
  $scope.height = 500; //grid (viewport) height
  $scope.width = 750;
  $scope.cellHeight = 25; //height of each cells
  $scope.realOffsetTop = $scope.offsetTop = 0; //data array offsetTop
  $scope.offsetLeft = 0;
  $scope.offsetRight = 7;
  $scope.scrollTop = $scope.scrollLeft = $scope.scrollOffsetLeft = 0; //in pixel
  $scope.rows = ($scope.height / $scope.cellHeight) | 0; //dynamic row count
  $scope.bodyHeight = $scope.height + 16; //+ scroll bar height
  $scope.headerHeight = $scope.cellHeight;

  //calculate height scale to possible scroll bar height
  function calcScale() {
    $scope.totalHeight = $scope.cellHeight * $scope.dataLength; //calc total height
    $scope.scale = 1; //initial scale
    if ($scope.totalHeight > maxScrollTop) {
      $scope.scale =  $scope.totalHeight / maxScrollTop;
      //approx
      $scope.totalHeight = maxScrollTop + $scope.height + ($scope.cellHeight / $scope.scale) - ($scope.height / $scope.scale);
    }
  }

  //initialize data
  initData();
  makeData(1e6, 0, fixedData);
  $scope.data = fixedData;
  $scope.dataLength = $scope.data.length;
  $scope.updated = 0;
  calcScale();

  //templates
  var TEMPLATE_ID = 'T_';
  var templates = {
    id: '<input type="text" ng-value="id" disabled />',
    text: 'Text {{id}}',
    percent: '<span class="percent" ng-style="width:{{percent}}px" ng-class="{green:percent>50,red:percent<30}"></span>',
    more: 'More ... {{field1 | toFixed}}',
    num: 'Num ... {{field2 | toFixed}}',
    date: '<input type="date" ng-value="field3|date:\'yyyy-MM-dd\'" disabled />'
  };

  for (var x in templates) {
    // console.log('T_', x, [templates[x]]);
    doTA.C[TEMPLATE_ID + x] = doTA.compile(templates[x],
      {dotaRender: TEMPLATE_ID, watchDiff: 1, diffLevel: 0, encode: 1, key: 'K'});
    // console.log(doTA.C['T_' + x])
  }

  //grid options
  $scope.gridOptions = [
    {id: 'id', name: 'ID', width: 90,
      template_id : 'id'},
    {id: 'label', name: 'Text', width: 130,
      template_id: 'text'},
    {id: 'percent', name: 'Progress', width: 110,
      template_id: 'percent'},
    {id: 'field1', name: 'More ...', width: 125,
      template_id: 'more'},
    {id: 'field2', name: 'Num ...', width: 125,
      template_id: 'num'},
    {id: 'field3', name: 'Date', width: 110,
      template_id: 'date'},
    {id: 'field4', name: 'Col 7', width: 125}
  ];
  // fill upto x columns
  var i = $scope.gridOptions.length + 1;
  do {
    $scope.gridOptions.push({id: 'field' + (i % 2 + 4), name: 'Col ' + i, width: 125});
  } while (++i <= 1e5);

  // merge cell templates to grid template
  var widthMap = [], totalWidth = 0;
  $scope.gridOptions.forEach(function(col, i) {
    totalWidth += col.width || 100;
    //width map, which sum upto x columns, to prevent extra loop at scroll event
    widthMap[i] = totalWidth;
  });
  // console.log('widthMap', widthMap.length, widthMap[0], widthMap[1e5-1], widthMap.slice(0, 10), widthMap.slice(-10), totalWidth);
  $scope.totalWidth = totalWidth;

  //get grid template from script tag
  var template = document.getElementById('grid-template').innerHTML;
  // template = template.replace('{header-outlet}', headerOutlet); //.replace('{cell-outlet}', cellOutlet);
  // console.log('template', template);
  // console.log('cellOutlet', cellOutlet);

  //compile template to fn
  var compileFn = doTA.compile(template, {strip: 1, encode: 1, loose: 0, event: 1,
    watchDiff: "updated", diffLevel: 3, debug: 0, dotaRender: TEMPLATE_ID});

  //write to dom
  var gridRoot = document.getElementById('grid');
  gridRoot.innerHTML = compileFn($scope, $filter);
  //add some events
  doTA.addEvents(gridRoot, $scope, {event: 'click dblclick mousemove'});

  //get cell x, y from event.target
  function getCellIndex(elem) {
    while (!elem.getAttribute('col')) {
      elem = elem.parentNode;
      if (elem === scrollElem || elem === gridRoot) { return; }
    }
    var col = elem.getAttribute('col'), row = elem.parentNode.getAttribute('row');
    if (row && col) return [row, col];
  }

  //click handler
  $scope.clickHandler = function($event, dbl) {
    var cellAt = getCellIndex($event.target);
    if (cellAt) {
      $scope.clickStatus = (dbl ? 'Double ' : '') + 'Clicked on cell (' + cellAt[0] + ', ' + cellAt[1] + ')';
    }
  }
  //mouse over handler
  $scope.hoverHandler = function($event) {
    var cellAt = getCellIndex($event.target);
    if (cellAt) {
      $scope.hoverStatus = 'Mouse over on cell (' + cellAt[0] + ', ' + cellAt[1] + ')';
    }
  }

  //option button for 1 million / 1 billion rows
  $scope.$watch('dataType', function(newVal, oldVal) {
    if (newVal !== oldVal) {
      console.log('new dataType', [+newVal, +oldVal]);

      if (+newVal === 1) {
        makeData($scope.rows, 0, data);
        $scope.data = data;
      } else {
        $scope.data = fixedData;
      }
      $scope.dataLength = +newVal === 1 ? 1e9 : $scope.data.length;
      $scope.totalHeight = $scope.cellHeight * $scope.dataLength;
      $scope.offsetTop = $scope.scrollTop = 0;
      if (scrollElem) { scrollElem.scrollTop = 0; } //bring scrollbar to top manually
      calcScale();
      $scope.updated++;

      console.log(
        'scale/rows/totalHeight', [$scope.scale, $scope.rows, $scope.totalHeight],
        'scrollLeft/scrollTop/offsetTop', [$scope.scrollLeft, $scope.scrollTop, $scope.offsetTop],
        'data/dataLength', [$scope.data.length, $scope.dataLength]
      );
    }
  });

  //build some shared data
  var random1, random2, random3, random4;
  var offset, idx;
  function makeData(count, start, data) {
    start = start || 0;
    data.length = 0;
    // console.time('makeData');
    for (idx = 0; idx < count; idx++) {
      offset = idx + start;
      data.push({
        id: offset,
        percent: random1[offset % 100],
        field1: random2[(offset + 10) % 100],
        field2: random3[(offset + 20) % 100],
        field3: random4[(offset + 30) % 100],

        field4: random2[(offset + 40) % 100],
        field5: random3[(offset + 50) % 100]
      });
    }
    // console.timeEnd('makeData');
    // return data;
  }

  function initData() {
    random1 = makeRandom(100, function(){ return Math.random() * 100 | 0;});
    random2 = makeRandom(100, function(){ return Math.random(); });
    random3 = makeRandom(100, function(){ return Math.random(); });
    random4 = makeRandom(100, function(){
      return (Math.random() + 0.3) * +new Date();
    });
  }

  function makeRandom(count, fn) {
    var ret = [];
    for (var i = 0; i < count; i++) {
      ret.push(fn());
    }
    return ret;
  }

});