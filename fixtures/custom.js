module.exports = {
  'array': '<div ng-repeat="x in arr">{{x}}</div>',
  'arrayWithFilter': '<div ng-repeat="x in arr|orderBy:name">{{x}}</div>',

  'dict': '<div ng-repeat="k,v in obj">{{k}}: {{v}}</div>',
  'dictWithFilter': '<div ng-repeat="k,v in obj|filter:name">{{k}}: {{v}}</div>',

  'range': '<div ng-repeat="x in 1:10">{{x}}</div>',
  'rangeStep2': '<div ng-repeat="x in 1:10:2">{{x}}</div>',
  'rangeRev': '<div ng-repeat="x in 10:1:-1">{{x}}</div>',
  'rangeInclusive': '<div ng-repeat="x in 1:=10">{{x}}</div>',

  'withFilter': '<div ng-repeat="x in arr">{{x | json}}</div>',
  'withComment': '<div ng-repeat="x in arr">{{x | json}}<!--test--></div><!--test2-->',
  'withFilterOptions': '<div ng-repeat="x in arr">{{x | date:"YYMMDD"}}<!--test--></div><!--test2-->',
}