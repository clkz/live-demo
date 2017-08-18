var app = angular.module('members', []);

app.controller('mainCtrl', ['$scope', '$filter', function ($scope, $filter) {
    var vars = $scope.vars = {
        date: new Date(),
        showAddModal: false,
        showIncomeModal: false,
        currentMember: null,
        incomeList: [],
        releationList: [],
        outlayList: []
    };


    var model = $scope.model = {
        performance: 0,
        total: 0,
        dayOfTotal: 0,
        members: [{ key: 'M00001', name: '会员1' }, { key: 'M00002', name: '会员2' }, { key: 'M00003', name: '会员3' }],
        incomeData: [],
        incomeData2: [],
    }
    var formModel = $scope.formModel = {
        currentDate: new Date()
    }

    $scope.modal = {
        close: function (modalKey) {
            vars[modalKey] = false;
        }
    }

    $scope.showOutLayModal = function (member) {
        vars.currentMember = member;
        $scope.addForm.amount = '';

        vars.showOutlayModal = !vars.showOutlayModal;
    }

    $scope.showIncomeModal = function (member) {
        vars.currentMember = member;
        $scope.settlement();

        vars.showIncomeModal = !vars.showIncomeModal;
    }

    $scope.settlement = function () {
        var maxIncome = $scope.query.maxIncome(vars.currentMember.key);
        var recommend = $scope.query.recommend(vars.currentMember.key);
        var inPoint = $scope.query.inPoint(vars.currentMember.key);
        var dividends = $scope.query.dividends(vars.currentMember.key);
        var guide = $scope.query.guide(vars.currentMember.key);
        var repeat = $scope.query.repeat(vars.currentMember.key);
        var total = $scope.query.total(vars.currentMember.key);

        var rows = [recommend, inPoint, dividends, guide, repeat].concat(total);

        var nodeInComeList = $filter('filter')(vars.incomeList, function (item) {
            return item.nodeKey === vars.currentMember.key;
        });

        var inPointTotal = 0, recommendTotal = 0;
        angular.forEach(nodeInComeList, function (item) {
            if (item.type === 'InPoint') {
                inPointTotal += item.amount
            }
            if (item.type === 'Recommend') {
                recommendTotal += item.amount
            }
        })

        rows.push({
            name: '直推奖2',
            amount: recommendTotal
        });
        rows.push({
            name: '见点奖2',
            amount: inPointTotal
        });

        model.maxIncome = maxIncome;
        model.incomeData = rows;
    }


    $scope.addForm = {
        amount: '',
        apply: function (parent) {
            var parentChilds = $filter('filter')(model.members,
                function (item) {
                    return item.parentKey === parent.key
                }),
                newMembers = [],
                parentKey = parent.key,
                currentKey = 'm' + (parentChilds.length + 1),
                recentNode = this.findRecentNode(parent);

            newMembers = [{
                key: parentKey + currentKey,
                name: parent.name + '-' + (parentChilds.length + 1),
                parentKey: parentKey,
                parentName: parent.name,
                parentNodeKey: recentNode.key,
                parentNodeName: recentNode.name,
                createDate: $filter('date')(formModel.currentDate, 'yyyy-MM-dd')
            }];

            model.members = model.members.concat(newMembers);

            $scope.storage.saveRealtions(newMembers[0]);
        },
        outlay: function () {
            vars.outlayList.push({
                memberKey: vars.currentMember.key,
                amount: this.amount - 0,
                inDate: $filter('date')(formModel.currentDate, 'yyyy-MM-dd')
            });
            $scope.storage.total();
            $scope.storage.saveIncome(vars.currentMember);
            vars.showOutlayModal = false;
        },
        findRecentNode: function (member) {
            var directNodeList = $scope.query.directNodeList(member.key);
            if (directNodeList.length < 3) return member;

            var allChilds = $scope.query.findChilds(member.key);
            for (var i = 0, ii = allChilds.length; i < ii; i++) {
                var childNodes = $scope.query.directNodeList(allChilds[i].key);
                if (childNodes.length < 3) return allChilds[i];
            }
        }
    }


    var inPointConfig = {
        level1: {
            layers: [1, 3, 5, 7],
            rate: 0.02
        },
        level2: {
            layers: [9, 11, 13],
            rate: 0.03
        },
        level3: {
            layers: [15, 17, 19],
            rate: 0.04
        }
    };


    var getInPointRate = function (level) {
        for (var key in inPointConfig) {
            var levelItem = inPointConfig[key];
            if (levelItem.layers && levelItem.layers.indexOf(level - 0) >= 0) {
                return levelItem.rate;
            }
        }
    }

    $scope.storage = {
        total: function () {
            var total = 0,
                dayOfTotal = 0,
                currentDate = $filter('date')($scope.formModel.currentDate, 'yyyy-MM-dd');

            angular.forEach(vars.outlayList, function (item) {
                total += (item.amount || 0);
            });

            var todayMembers = $filter('filter')(vars.outlayList,
                function (item) { return item.inDate === currentDate });

            angular.forEach(todayMembers, function (item) {
                dayOfTotal += (item.amount || 0);
            });

            model.total = total;
            model.dayOfTotal = dayOfTotal;
        },
        loop: function (memberKey, callback) {
            var childs = $filter('filter')(model.members, function (item) { return item.key === memberKey });
            if (!childs.length) return;
            callback && callback(childs[0]);
            this.loop(childs[0].parentNodeKey, callback);
        },

        saveRealtions: function (member) {
            var index = 1;
            this.loop(member.parentNodeKey, function (item) {
                vars.releationList.push({
                    nodeKey: member.key,
                    parentNodeKey: item.key,
                    layerNumber: index++,
                    isDirect: member.parentKey === item.key
                })
            })
        },

        saveIncome: function (member) {
            var dataString = $filter('date')(formModel.currentDate, 'yyyy-MM-dd'),
                parent = $filter('filter')(model.members, function (item) {
                    return item.key === member.parentKey;
                })[0],
                selfAmount = $scope.query.nodeOutlay(member.key),
                parentPaiedAmount = parent && $scope.query.nodeOutlay(parent.key) || 0;
            if (!parent) return;

            //直推奖：给直接上级贡献 20%
            vars.incomeList.push({
                nodeKey: parent.key,
                type: 'Recommend',
                name: '直推奖',
                amount: selfAmount * 0.2,
                from: member.key,
                inDate: dataString
            });

            var inPointTotal = 0, releationList = $filter('filter')(vars.releationList, function (item) {
                return item.nodeKey === member.key;
            });

            angular.forEach(releationList, function (relationItem) {
                var rateVal = getInPointRate(relationItem.layerNumber);
                if (rateVal) {
                    var parentNodePaiedAmount = $scope.query.nodeOutlay(relationItem.parentNodeKey);
                    var endlessAmount = Math.min(selfAmount, parentNodePaiedAmount);

                    //见点奖
                    vars.incomeList.push({
                        nodeKey: relationItem.parentNodeKey,
                        type: 'InPoint',
                        name: '见点奖',
                        amount: Math.round(endlessAmount * rateVal),
                        from: member.key,
                        inDate: dataString
                    });
                }
            });

        }
    }

    $scope.query = {
        directNodeList: function (memberKey) {
            return $filter('filter')(vars.releationList,
                function (item) {
                    return item.parentNodeKey === memberKey && item.isDirect === true
                });
        },
        nodeIncome: function (memberKey) {
            var recommendVal = 0; //this.recommend(memberKey);
            var inPointVal = 0;// this.inPoint(memberKey);
            var dividendsVal = 0;//this.dividends(memberKey);
            var guideVal = 0;// this.guide(memberKey);//TODO:暂时无法加入指导奖的计算，但需要算在总收入里面

            return recommendVal + inPointVal + dividendsVal + guideVal;
        },
        //TODO:性能大户3
        nodeOutlay: function (memberKey) {
            var selfItem = $filter('filter')(model.members, function (item) { return item.key === memberKey })[0];
            var selfAmount = 0, selfOutLays = $filter('filter')(vars.outlayList,
                function (item) { return item.memberKey === memberKey });

            angular.forEach(selfOutLays, function (outlayItem) {
                selfAmount += outlayItem.amount;
            });
            return selfAmount;
        },
        //TODO:性能大户1
        paiedMembers: function (memberKey) {
            var childs = $filter('filter')(model.members, function (item) {
                return item.parentKey === memberKey;
            });

            return $filter('filter')(childs, function (item) {
                var childOutlays = $filter('filter')(vars.outlayList, function (oitem) {
                    return oitem.memberKey === item.key;
                });
                return item.parentKey === memberKey && !!childOutlays.length
            });
        },
        //TODO:性能大户2
        childOutlays: function (memberKey) {
            var childs = $filter('filter')(model.members, function (item) {
                return item.parentKey === memberKey;
            });

            return $filter('filter')(vars.outlayList, function (oitem) {
                return !!$filter('filter')(childs, function (citem) {
                    return citem.key === oitem.memberKey;
                }).length;
            });
        },
        //TODO:性能大户
        staticNodeList: function () {
            var self = this,
                currentDate = $filter('date')(formModel.currentDate, 'yyyy-MM-dd');
            var result = [];
            return $filter('filter')(model.members, function (memberItem) {
                var childNodes = self.paiedMembers(memberItem.key);
                return !childNodes.length;
            });
        },
        //最大收益限制
        maxIncome: function (memberKey) {
            var selfAmount = this.nodeOutlay(memberKey);
            var outLaiedChilds = this.paiedMembers(memberKey);
            var childOutlays = this.childOutlays(memberKey);
            var total = 0;

            if (!outLaiedChilds.length) {
                total += selfAmount * 2;
            }
            else if (outLaiedChilds.length === 1) {
                total += selfAmount * 3;
            }
            else if (outLaiedChilds.length === 2) {
                total += selfAmount * 4;
            }
            else if (outLaiedChilds.length > 2) {
                total += selfAmount * 5;
            }

            angular.forEach(childOutlays, function (item) {
                total += item.amount;
            });

            if (total > selfAmount * 5) {
                total = selfAmount * 5;
            }

            return total;
        },
        //直推
        recommend: function (memberKey) {
            var total = 0;
            var childOutlays = this.childOutlays(memberKey);

            for (var i = 0, ii = childOutlays.length; i < ii; i++) {
                total += (childOutlays[i].amount * 0.2);//20%
            }

            return {
                type: 'Recommend',
                name: '直推奖',
                freezed: false,
                amount: total
            }
        },
        //见点
        inPoint: function (memberKey) {
            var self = this;
            var config = {
                level1: {
                    layers: [1, 3, 5, 7],
                    rate: 0.02
                },
                level2: {
                    layers: [9, 11, 13],
                    rate: 0.03
                },
                level3: {
                    layers: [15, 17, 19],
                    rate: 0.04
                },
                getRate: function (level) {
                    for (var key in config) {
                        if (typeof config[key] !== 'function') {
                            var levelItem = config[key];
                            if (levelItem.layers && levelItem.layers.indexOf(level - 0) >= 0) {
                                return levelItem.rate;
                            }
                        }
                    }
                }
            }
            var selfAmount = self.nodeOutlay(memberKey);
            var total = 0,
                releationList = $filter('filter')(vars.releationList, function (item) {
                    return item.parentNodeKey === memberKey;
                });

            angular.forEach(releationList, function (relationItem) {
                var rateVal = config.getRate(relationItem.layerNumber);
                var childOutlayAmount = self.nodeOutlay(relationItem.nodeKey);
                var endlessAmount = Math.min(selfAmount, childOutlayAmount);

                if (rateVal) {
                    total += Math.round(endlessAmount * rateVal)
                }
            });

            return {
                type: 'InPoint',
                name: '见点奖',
                freezed: false,
                amount: total
            }
        },
        //加权分红
        dividends: function (memberKey) {
            var dVal = 0;
            var staticNodes = this.staticNodeList();
            angular.forEach(staticNodes, function (item) {
                if (item.key === memberKey) {
                    dVal = Math.round((model.dayOfTotal * 0.2) / staticNodes.length);
                }
            });

            return {
                type: 'Dividends',
                name: '加权分红',
                freezed: false,
                amount: dVal
            }
        },
        //指导奖
        guide: function (memberKey) {
            var selfOutlayAmount = this.nodeOutlay(memberKey);
            var selfIncomeAmount = this.nodeIncome(memberKey);
            var selfItem = $filter('filter')(model.members, function (item) { return item.key === memberKey })[0];

            var parentCalculateAmount = 0;
            if (selfIncomeAmount <= selfOutlayAmount * 0.05) {
                var parent = $filter('filter')(model.members, function (item) { return item.key === selfItem.parentKey })[0];
                if (parent) {
                    parentCalculateAmount = this.inPoint(parent.key).amount + this.dividends(parent.key).amount;
                    var counter = 5 - 1, parent = {};
                    while (counter > 0 && !parentCalculateAmount) {
                        if (parentCalculateAmount) {
                            parent = $filter('filter')(model.members, function (item) { return item.key === parent.parentKey })[0];
                            if (parent) {
                                parentCalculateAmount = this.inPoint(parent.key).amount + this.dividends(parent.key).amount;
                            }
                            else {
                                break;
                            }
                        }
                        counter--;
                    }
                }
            }

            return {
                type: 'Guide',
                name: '辅导奖（互助金）',
                freezed: false,
                amount: parentCalculateAmount * 0.1,
                inDate: $filter('date')(formModel.currentDate, 'yyyy-MM-dd')
            }
        },
        //重复消费
        repeat: function (memberKey) {
            return {
                type: 'Repeat',
                name: '复消提成',
                freezed: false,
                amount: 0
            };
        },
        total: function (memberKey) {
            var recommendVal = this.recommend(memberKey).amount;
            var inPointVal = this.inPoint(memberKey).amount;
            var dividendsVal = this.dividends(memberKey).amount;
            var guideVal = this.guide(memberKey).amount;
            var repeatVal = this.repeat(memberKey).amount;

            var maxIncomeVal = this.maxIncome(memberKey);

            var totalVal = recommendVal + inPointVal + inPointVal + guideVal + repeatVal;

            var enabledVal = totalVal > maxIncomeVal ? maxIncomeVal : totalVal;

            return [
                {
                    type: 'Total',
                    name: '收益总额',
                    freezed: false,
                    amount: totalVal
                },
                {
                    type: 'Lock',
                    name: '冻结资金',
                    freezed: false,
                    amount: totalVal > maxIncomeVal ? totalVal - maxIncomeVal : 0
                },
                {
                    type: 'Enabled',
                    name: '可用资金(手续费：6%)',
                    freezed: false,
                    amount: enabledVal - Math.round(enabledVal * 0.06)
                }
            ];

        },
        findChilds: function (key, members) {
            if (!members) members = [];
            var childs = $filter('filter')(model.members, function (item) { return item.parentNodeKey === key });
            if (!childs.length) return members;
            members = members.concat(childs);
            for (var i = 0, ii = childs.length; i < ii; i++) {
                members = this.findChilds(childs[i].key, members);
            }
            return members;
        }
    }

}])