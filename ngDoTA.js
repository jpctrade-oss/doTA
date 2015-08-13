/* global angular, doTA */
(function (angular, document) {'use strict';
  var msie = document.documentMode;
  var textContent = msie <= 8 ? 'innerText' : 'textContent';
  var hiddenDIV;
  setTimeout(function(){
    if (document.createElement) {
      // hiddenDIV = document.getElementById('dota-cache');
      // //add ngDoTA.min.js at the end body
      // if (!hiddenDIV && document.body) {
        hiddenDIV = document.createElement('div');
        // hiddenDIV.id = 'dota-cache';
        // hiddenDIV.style.display = 'none';
        // document.body.appendChild(hiddenDIV);
      // }
    }
  });
  var BoolMap = {0: 0, 'false': 0};
  function makeBool(attr, defaultValue){
    return attr in BoolMap ? BoolMap[attr] : attr || defaultValue;
  }

  function forEachArray(src, iter, ctx) {
    if (src.forEach) {
      return src.forEach(iter);
    }
    for (var key = 0, length = src.length; key < length; key++) {
      if (key in src) {
        iter.call(ctx, src[key], key);
      }
    }
    return src;
  }

  //something like $eval to read value from nested objects with dots
  function resolveObject(path, obj) {
    return path.indexOf('.') >= 0 ? path.split('.').reduce(function (prev, curr) {
      return prev ? prev[curr] : undefined;
    }, obj) : obj[path];
  }

  //something like $parse
  function parseObject(path, obj) {
    if (path.indexOf('.') >= 0) {
      var paths = path.split('.');
      path = paths.splice(-1, 1)[0];
      // console.log('path, last', paths, last)
      obj = paths.reduce(function (prev, curr) {
        // console.log('parseObject', [prev, curr])
        if (!prev[curr]) {
          prev[curr] = {};
        }
        return prev[curr];
      }, obj);
    }
    return {
      assign: function(val) {
        obj[path] = val;
      }
    };
  }

  // var obj = {};
  // var parsed = parseObject('name', obj);
  // parsed.assign('test');
  // console.log(obj);
  // parsed = parseObject('three.one', obj);
  // parsed.assign('haha');
  // console.log(obj);

  //debounce for events
  // function debounce(fn, timeout) {
  //   if (timeout === undefined) {
  //     timeout = 200;
  //   }
  //   var timeoutId;
  //   var args, thisArgs;
  //   function debounced() {
  //     fn.apply(thisArgs, args);
  //   }
  //   return function() {
  //     args = arguments;
  //     thisArgs = this;
  //     if (timeoutId) {
  //       clearTimeout(timeoutId);
  //     }
  //     // console.log('debounce: new timer', [timer]);
  //     timeoutId = setTimeout(debounced, timeout);
  //   };
  // }

  //throttle for events
  function throttle(fn, timeout) {
    if (timeout === undefined) {
      timeout = 200;
    }
    var timeoutId;
    var start = +new Date(), now;
    // console.log('timeout', timeout)
    var args, thisArgs;
    function throttled() {
      fn.apply(thisArgs, args);
    }
    return function() {
      args = arguments;
      thisArgs = this;
      now = +new Date();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (now - start >= timeout) {
        // console.log(now - start)
        start = now;
        throttled();
        return;
      }
      // console.log('throttled: new timer', [timer]);
      timeoutId = setTimeout(throttled, timeout);
    };
  }

  //hide and destroy children
  function destroyChildren(elem) {
    var child = elem.firstChild, hiddenTags = [];
    if (child) {
      child.hidden = 1;
      hiddenTags.push(child);
      while (child = child.nextSibling) {
        child.hidden = 1;
        hiddenTags.push(child);
      }
    }
    //destroying children block everything
    // so do it later, since deleting don't have to be synchronous
    setTimeout(function(){
      console.time('removeChild');
      forEachArray(hiddenTags, function(child) {
        if (child && child.parentNode) {
          child.parentNode.removeChild(child);
        }
      });
      console.timeEnd('removeChild');
    })
  }

  function addEvent(partial, scope, uniqId) {
    if (partial.de) { return; } //only attach events once
    var attrs = partial.attributes;
    // console.log('attrs', uniqId, attrs);
    for(var i = 0, l = attrs.length; i < l; i++){
      if (attrs[i].name.substr(0,3) === 'de-') {
        partial.addEventListener(attrs[i].name.substr(3), (function(target, attr){
          return function(evt){
            if (!evt.target) { //make $event.target always available
              evt.target = evt.srcElement;
            }
            evt.preventDefault();
            evt.stopPropagation();
            //isedom: disallow, so no $target here
            scope.$evalAsync(attr.value, {$event: evt});
          };
        })(partial, attrs[i]));
        console.log('event added', uniqId, attrs[i].name);
      }
    }
    partial.de = 1;
  }

  function addEvents(elem, scope, uniqId) {
    var elements = elem.querySelectorAll('[de]');
    for (var i = 0, l = elements.length; i < l; i++) {
      addEvent(elements[i], scope, uniqId);
      elements[i].removeAttribute('de');
    }
  }

  function addNgModel(elem, scope, uniqId) {
    forEachArray(elem.querySelectorAll('[ng-model]'), function(partial) {
      var dotaPass = partial.getAttribute('dota-pass');
      // console.log('dotaPass', [dotaPass]);
      if (dotaPass != undefined) { return; } //null or undefined

      //override ng-model
      var modelName = partial.getAttribute('ng-model');
      partial.removeAttribute('ng-model');

      //textbox default event is input unless IE8, all others are change event
      var updateOn = partial.getAttribute('update-on') ||
        (partial.type !== 'text' || msie <= 8 ? 'change' : 'input');
      var throttleVal = +partial.getAttribute('throttle') || 100;

      //use checked property for checkbox and radio
      var bindProp = partial.getAttribute('bind-prop') ||
        ((partial.type === 'checkbox' || partial.type === 'radio') && 'checked');
      var curValue = resolveObject(modelName, scope) || '';

      // console.log('partial', [partial.tagName, partial.type])
      if (bindProp) {
        //set true or false on dom properties
        partial[bindProp] = partial.value === curValue;
      } else {
        partial.value = curValue;
      }

      //bind each events
      var parsed;
      forEachArray(updateOn.split(' '), function(evtName){
        evtName = evtName.trim();
        partial.addEventListener(evtName, throttle(function(evt) {
          if (!parsed) {
            parsed = parseObject(modelName, scope);
          }
          evt.preventDefault();
          evt.stopPropagation();

          // console.log('event', evtName, evt.target, [evt.target[bindProp || 'value']])
          scope.$applyAsync((function(){
            if (bindProp) {
              parsed.assign(bindProp && evt.target[bindProp] ? evt.target.value : undefined);
            } else {
              parsed.assign(evt.target.value);
            }
          }))
        }, throttleVal));
      });
    });
  }

  angular.module('doTA', [])
    .config(['$provide',function(P) {
      P.factory('doTA', function(){
        doTA.addEvents = addEvents;
        return doTA;
      });
    }])

    .directive('dotaRender', ['doTA', '$http', '$filter', '$templateCache', '$compile', '$controller',
      function(doTA, $http, $filter, $templateCache, $compile, $controller) {
      return {
        restrict: 'A',
        priority: 10000,
        terminal: true,
        controller: angular.noop,
        link: angular.noop,
        compile: function() {
          var Watchers = [], BindValues = {}; //New scope flag, new Scope

          return function($scope, elem, attrs) {
            //used attributes, good for minification with closure compiler;
            var attrCacheDOM = attrs.cacheDom;
            var attrDoTARender = attrs.dotaRender;
            var attrScope = attrs.scope;
            var attrNgController = attrs.ngController;
            var attrLoose = attrs.loose;
            var attrOptimize = attrs.optimize;
            var attrEvent = attrs.event;
            var attrDebug = attrs.debug;
            var attrWatch = attrs.watch;
            var attrEncode = attrs.encode;
            var attrCompile = attrs.compile;
            var attrModel = attrs.model;
            var attrBind = attrs.bind;
            var attrCompileAll = attrs.compileAll;
            var attrDoTAOnload = attrs.dotaOnload;
            var attrDoTAOnloadScope = attrs.dotaOnloadScope;
            var attrLoaded = attrs.loaded;
            var attrInline = attrs.inline;
            var attrWatchDiff = attrs.watchDiff;
            var origAttrMap = attrs.$attr;
            var NewScope;

            attrLoose = attrs.loose = makeBool(attrLoose, 1); //falsy => ''
            attrOptimize = attrs.optimize = makeBool(attrOptimize, 0);
            attrDebug = attrs.debug = makeBool(attrDebug, 0);
            attrEvent = attrs.event = makeBool(attrEvent, 1); //ng-click to native click
            attrWatch = attrs.watch = typeof attrWatch === 'string' ? attrWatch : 0; //Firefox throw error if does not exists
            var params = {};

            if (attrCacheDOM && doTA.D[attrDoTARender]) {
              // alert( doTA.D[attrDoTARender].innerHTML);
              console.log('cacheDOM: just moved cached DOM', doTA.D[attrDoTARender]);
              var cachedElem = msie ? doTA.D[attrDoTARender].cloneNode(true) : doTA.D[attrDoTARender];
              elem[0].parentNode.replaceChild(cachedElem, elem[0]);
              return;
            }

            //attributes on dota-render tags to be accessiable as $attr in templates
            for (var x in origAttrMap) {
              var z = origAttrMap[x];
              //map data-* attributes into origAttrMap (inline text)
              if (!z.indexOf('data-')) {
                params[x] = attrs[x];
              //map scope-* attributes into origAttrMap (first level var from scope)
              } else if (!z.indexOf('scope-')) {
                if (attrs[x].indexOf('.') >= 0 || attrs[x].indexOf('[') >= 0) {
                  params[z.slice(6)] = $scope.$eval(attrs[x]);
                } else {
                  params[z.slice(6)] = $scope[attrs[x]];
                }
              }
            }

            //create new scope if scope=1 or ng-controller is specified
            if (attrScope || attrNgController) {
              console.log('scope', attrScope);
              NewScope = $scope.$new();
              console.log('newScope created', attrDoTARender, NewScope);
            } else {
              NewScope = $scope;
            }

            //attach ng-controller, and remove attr to prevent angular running again
            if (attrNgController) {
              var asPos = attrNgController.indexOf(' as ');
              if (asPos > 0) {
                attrNgController = attrNgController.substr(0, asPos).trim();
              }
              console.log('new controller', attrNgController);
              var l = {$scope: NewScope}, controller = $controller(attrNgController, l);
              if (attrs.controllerAs || asPos > 0) {
                NewScope[attrs.controllerAs || attrNgController.substr(asPos + 4).trim()] = controller;
              }
              elem[0].removeAttribute('ng-controller');
              elem.data('$ngControllerController', controller);
              elem.children().data('$ngControllerController', controller);
              console.log('new controller created', attrDoTARender);
            }

            // watch and re-render the whole template when change
            if(attrWatch) {
              console.log(attrDoTARender, 'registering watch for', attrWatch);
              NewScope.$watchCollection(attrWatch, function(newVal, oldVal){
                if(newVal !== oldVal && doTA.C[attrDoTARender]) {
                  console.log(attrDoTARender, 'watch before render');
                  render(doTA.C[attrDoTARender]);
                  console.log(attrDoTARender, 'watch after render');
                }
              });
            }

            // watch and partially render by diffing. diff-level = 2 may be used to patch children
            if(attrWatchDiff) {
              console.log(attrDoTARender, 'registering diff watch for', attrWatchDiff);
              NewScope.$watchCollection(attrWatchDiff, function(newVal, oldVal){
                if(newVal !== oldVal && doTA.C[attrDoTARender]) {
                  console.log(attrDoTARender, 'diff watch before render');
                  render(doTA.C[attrDoTARender], true);
                  console.log(attrDoTARender, 'diff watch after render');
                }
              });
            }

            // run the loader
            loader();

            ////////////////////////////////////////////////////////////////////////////
            // cache-dom for static html, $scope will not be triggered
            ////////////////////////////////////////////////////////////////////////////
            function cacheDOM(){
              // console.log('cacheDOM()', attrs)
              $scope.$on("$destroy", function(){
                console.log('$destroy', elem);
                // alert(['$destroy', elem[0], hiddenDIV]);
                if (hiddenDIV) {
                  doTA.D[attrDoTARender] = elem[0];
                  hiddenDIV.appendChild(elem[0]);
                }
              });
            }

            ////////////////////////////////////////////////////////////////////////////
            // doTA.compile and return compiledFn
            ////////////////////////////////////////////////////////////////////////////
            function compile(template) {
              if(attrDebug) {
                console.log([attrEncode], [template]);
              }

              console.log(attrDoTARender,'before compile');
              //compile the template html text to function like doT does
              try {
                console.time('compile:' + attrDoTARender);
                var compiledFn = doTA.compile(template, attrs);
                console.timeEnd('compile:'  + attrDoTARender);
                console.log(attrDoTARender,'after compile(no-cache)');
              } catch (x) {
                /**/console.log('compile error', attrs, template);
                throw x;
              }

              //compiled func into cache for later use
              if (attrDoTARender) {
                doTA.C[attrDoTARender] = compiledFn;
              }

              return compiledFn;
            }

            ////////////////////////////////////////////////////////////////////////////
            // attach ng-model, events, ng-bind, and $compile
            ////////////////////////////////////////////////////////////////////////////
            function attachEventsAndCompile(rawElem, scope) {

              if (attrModel) {
                addNgModel(rawElem, scope, attrDoTARender);
              }

              //attach events before replacing
              if (attrEvent) {
                addEvents(rawElem, scope, attrDoTARender);
              }

              //ng-bind
              if (attrBind) {
                //remove old watchers, async
                while (Watchers.length) {
                  Watchers.pop()();
                }

                forEachArray(rawElem.querySelectorAll('[ng-bind]'), function(partial) {
                  //override ng-bind
                  var bindExpr = partial.getAttribute('ng-bind');
                  partial.removeAttribute('ng-bind');

                  if (BindValues[bindExpr]) {
                    partial.innerHTML = BindValues[bindExpr];
                  }
                  Watchers.push(scope.$watchCollection(bindExpr, function(newVal, oldVal){
                    if(newVal !== oldVal) {
                      console.log(attrDoTARender, 'watch before bindExpr', newVal);
                      partial[textContent] = BindValues[bindExpr] = newVal || '';
                      console.log(attrDoTARender, 'watch after render');
                    }
                  }));
                });
              }

              //$compile html if you need ng-model or ng-something
              if (attrCompile){
                //partially compile each dota-pass and its childs,
                // not sure this is suitable if you have so many dota-passes
                forEachArray(rawElem.querySelectorAll('[dota-pass]'), function(partial){
                  $compile(partial)(scope);
                });
                console.log(attrDoTARender,'after $compile partial');

              } else if (attrCompileAll){
                //compile child nodes
                $compile(rawElem.contentDocument || rawElem.childNodes)(scope);
                console.log(attrDoTARender,'after $compile all');
              }
            }

            ////////////////////////////////////////////////////////////////////////////
            // render the template, cache-dom, run onload scripts, add dynamic watches
            ////////////////////////////////////////////////////////////////////////////
            function render(func, patch) {

              //unless prerender
              if (func) {
                //trigger destroying children
                if (!patch && elem[0].firstChild) {
                  destroyChildren(elem[0]);
                }

                console.log(attrDoTARender, 'before render', patch);
                //execute render function against scope, $filter, etc.
                try {
                  console.time('render:' + attrDoTARender);
                  var v = func.F ? func.F(NewScope, $filter, params, patch) : func(NewScope, $filter, params, patch);
                  console.timeEnd('render:' + attrDoTARender);
                  console.log(attrDoTARender,'after render', patch);
                } catch (x) {
                  /**/console.log('render error', func);
                  throw x;
                }

                if(attrDebug) {
                  /* */console.log(attrDoTARender, v);
                  // console.log(attrDoTARender, (func.F || func).toString());
                }

                // console.log('patch?', [patch]);
                if (patch) {
                  attachEventsAndCompile(elem[0], NewScope);
                  return;
                }

                //if node has some child, use appendChild
                if (elem[0].firstChild) {
                  console.time('appendChild:' + attrDoTARender);
                  var newNode = document.createElement('div'), firstChild;
                  newNode.innerHTML = v;

                  //if needed, attach events and $compile
                  attachEventsAndCompile(newNode, NewScope);

                  //move child from temp nodes
                  while (firstChild = newNode.firstChild) {
                    elem[0].appendChild(firstChild);
                  }
                  console.timeEnd('appendChild:' + attrDoTARender);
                  console.log(attrDoTARender, 'after appendChild');

                //if node is blank, use innerHTML
                } else {
                  console.time('innerHTML:' + attrDoTARender);
                  elem[0].innerHTML = v;
                  console.timeEnd('innerHTML:' + attrDoTARender);
                  console.log(attrDoTARender, 'after innerHTML');

                  //if needed, attach events and $compile
                  attachEventsAndCompile(elem[0], NewScope);
                }

              //attach client side to prerender context
              } else {
                attachEventsAndCompile(elem[0], NewScope);
              }

              //execute raw functions, like jQuery
              if(attrDoTAOnload){
                setTimeout(function(){
                  var onLoadFn = new Function(attrDoTAOnload);
                  onLoadFn.apply(elem[0]);
                  console.log(attrDoTARender,'after eval');
                });
              }

              //execute scope functions
              if(attrDoTAOnloadScope) {
                setTimeout(function() {
                  NewScope.$evalAsync(attrDoTAOnloadScope);
                  console.log(attrDoTARender, 'after scope $evalAsync scheduled');
                });
              }

              if (attrCacheDOM) {
                cacheDOM();
              }

              //you can now hide raw html before rendering done
              // with loaded=false attribute and following css
              /*
              [dota-render][loaded]:not([loaded=true]) {
                display: none;
              }
              */
              if (attrLoaded) {
                elem.attr("loaded",true);
              }

              //this watch may be dynamically add or remove
              if (func && func.W) {
                console.log('func.W watch', attrDoTARender, func.W);
                var scopes = {}, watches = {};
                for(var i = 0; i < func.W.length; i++) {
                  var w = func.W[i];
                  // console.log('watch', w);

                  watches[w.I] = NewScope.$watchCollection(w.W, (function(w) {
                    return function(newVal, oldVal){
                      console.log('$watch trigger', [newVal, oldVal]);
                      if (newVal === oldVal && !newVal) { return; }
                      console.log(attrDoTARender, w.W, 'partial watch before render');
                      var oldTag = document.getElementById(w.I);
                      if (!oldTag) { return console.log('tag not found'); }

                      //we don't need new scope here
                      var content = w.F(NewScope, $filter, params, null, w.N);
                      if (!content) { return console.log('no contents'); }
                      console.log('watch new content', content);
                      var newTag = angular.element(content);

                      //compile only if specified
                      if (w.C) {
                        //scope management
                        if (scopes[w.I]) {
                          scopes[w.I].$destroy();
                        }
                        scopes[w.I] = NewScope.$new();
                      }

                      attachEventsAndCompile(newTag[0], scopes[w.I] || NewScope);

                      angular.element(oldTag).replaceWith(newTag);

                      console.log(attrDoTARender, w.W, 'partial watch content written');
                      //unregister watch if wait once
                      if (w.O) {
                        console.log(attrDoTARender, w.W, 'partial watch unregistered');
                        watches[w.I]();
                      }
                      console.log(attrDoTARender, w.W, 'partial watch after render');
                    };
                  })(w));
                }
              }
            }

            function loader(){
              if(doTA.C[attrDoTARender]){
                console.log(attrDoTARender,'get compile function from cache');
                //watch need to redraw, also inline, because inline always hasChildNodes
                if (elem[0].hasChildNodes() && !attrInline) {
                  console.log('hasChildNodes', attrDoTARender);
                  render();
                } else {
                  render(doTA.C[attrDoTARender]);
                }
              } else if (attrInline) {
                // render inline by loading inner html tags,
                // html entities encoding sometimes need for htmlparser here or you may use htmlparser2 (untested)
                console.log(attrDoTARender,'before get innerHTML');
                var v = elem[0].innerHTML;
                console.log(attrDoTARender,'after get innerHTML');
                render(compile(v, attrs));
              } else if (attrDoTARender) { //load real template
                console.log('before $http', attrDoTARender);
                //server side rendering or miss to use inline attrs?
                if (elem[0].hasChildNodes()) {
                  console.log('hasChildNodes', attrDoTARender);
                  render();
                } else {
                  $http.get(attrDoTARender, {cache: $templateCache}).success(function (v) {
                    console.log('after $http response', attrDoTARender);
                    render(compile(v, attrs));
                  });
                }
              }
            }

            //////////////////////////////////////////////////

          };
        }
      };
    }])
    .directive('dotaInclude', ['$http', '$templateCache', '$compile', function($http, $templateCache, $compile) {
      return {
        restrict: 'A',
        priority: 10000,
        terminal: true,
        compile: function() {
          return function(scope, elem, attrs) {
            console.log('dotaInclude', attrs.dotaInclude);
            $http.get(attrs.dotaInclude, {cache: $templateCache}).success(function (data) {
              elem.html(data);
              if (attrs.compile !== 'false') {
                $compile(elem.contents())(scope);
              }
            });
          };
        }
      };
    }])
    .directive('dotaTemplate', ['$http', '$templateCache', '$compile', function($http, $templateCache, $compile) {
      return {
        restrict: 'A',
        priority: 10000,
        terminal: true,
        compile: function() {
          return function(scope, elem, attrs) {
            scope.$watch(attrs.dotaTemplate, function(newVal, oldVal) {
              if (newVal) {
                console.log('dotaTemplate', newVal);
                $http.get(newVal, {cache: $templateCache}).success(function (data) {
                  elem.html(data);
                  if (attrs.compile !== 'false') {
                    $compile(elem.contents())(scope);
                  }
                });
              }
            });
          };
        }
      };
    }])
    .factory('dotaHttp', ['$compile', '$http', '$templateCache', '$filter', 'doTA',
      function($compile, $http, $templateCache, $filter, doTA) {
      return function (name, scope, callback, options){
        options = options || {};
        options.loose = 1;
        // options.debug = 1;
        // /**/console.log('options')

        if (doTA.C[name]) {
          // /**/console.log('dotaHttp doTA cache', name);
          callback(doTA.C[name](scope, $filter));
        } else {
          // /**/console.log('dotaHttp $http', name);
          $http.get(name, {cache: $templateCache}).success(function(data) {
            // /**/console.log('dotaHttp response', data);
            doTA.C[name] = doTA.compile(data, options);
            callback(doTA.C[name](scope, $filter));
          });
        }
      };
    }]);

})(window.angular, window.document);
