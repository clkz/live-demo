var app = angular.module('members', []);

app.controller('mainCtrl', ['$scope', function ($scope) {

    $scope.model = {
        date: new Date(),
        members: [{ name: '会员1' }, { name: '会员2' }]
    }
    $scope.formModel = {
        currentDate: new Date()
    }

}])