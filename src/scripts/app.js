var app = angular.module('members', []);

app.controller('mainCtrl', ['$scope', function ($scope) {
    $scope.model = {
        members: [{ name: '会员1' }, { name: '会员2' }]
    }

}])