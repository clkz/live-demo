var app = angular.module('members', []);

app.controller('mainCtrl', ['$scope', function ($scope) {
    var vars = $scope.vars = {
        date: new Date(),
        showAddModal: false,
        currentMember: null
    }


    var model = $scope.model = {
        members: [{ name: '会员1' }, { name: '会员2' }]
    }
    $scope.formModel = {
        currentDate: new Date()
    }

    $scope.showAddModal = function (member) {
        vars.currentMember = member;

        vars.showAddModal = !vars.showAddModal;
    }

    $scope.addForm = {
        rows: [{ key: 'm1' }],
        members: {},
        amounts: {},
        addNewRow: function () {
            var newKey = ('m' + this.rows.length + 1);
            this.rows.push({ key: newKey });
        },
        apply: function () {
            var newMembers = [];
            for (var i = 0, ii = this.rows.length; i < ii; i++) {
                var formItem = this.rows[i];
                newMembers.push({
                    name: vars.currentMember.name + '-' + (this.members[formItem.key] || (i + 1)),
                    parent: vars.currentMember.name,
                    amount: this.amounts[formItem.key] || 0
                });
            }
            model.members = model.members.concat(newMembers);
            vars.showAddModal = false;
        }
    }

}])