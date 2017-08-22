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

    $scope.settlementDividends = function () {
        $scope.storage.saveDividendsIncome();
    }

    $scope.settlementGuide = function () {
        //TODO:定时循环结算指导奖
        $scope.storage.saveGuideIncome(vars.currentMember.key);

        $scope.settlement();
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

        model.maxIncome = maxIncome;
        model.balanceMaxIncome = maxIncome - total[0].amount;

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


            var selfOutlayAmount = $scope.query.nodeOutlay(vars.currentMember.key);

            var selfItem = $filter('filter')(model.members, function (item) {
                return item.key === vars.currentMember.key;
            })[0];

            if (selfItem) {
                selfItem.outlays = [
                    {
                        name: '总消费',
                        amount: selfOutlayAmount
                    },
                    {
                        name: '本次消费',
                        amount: this.amount - 0
                    }
                ]
                // model.members = angular.copy(model.members);
            }

            vars.showOutlayModal = false;
        },
        findRecentNode: function (member) {
            var directNodeList = $scope.query.nodeOfChilds(member.key);
            if (directNodeList.length < 3) return member;

            var allChilds = $scope.query.findChilds(member.key);
            for (var i = 0, ii = allChilds.length; i < ii; i++) {
                var childNodes = $scope.query.nodeOfChilds(allChilds[i].key);
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

        },
        saveDividendsIncome: function () {
            var dateString = $filter('date')(formModel.currentDate, 'yyyy-MM-dd');
            //当天没有收益的所有会员
            var allNoIncomeMembers = $filter('filter')(model.members, function (item) {
                var incomeList = $filter('filter')(vars.incomeList, function (item1) {
                    return item1.nodeKey === item.key && item1.inDate === dateString;
                });
                return !incomeList.length
            });
            var perDividendsOfMembers = Math.round((model.dayOfTotal * 0.2) / allNoIncomeMembers.length);

            angular.forEach(allNoIncomeMembers, function (item) {
                var memberOutlay = $scope.query.nodeOutlay(item.key);
                var memberMaxDividends = Math.round(memberOutlay * 0.01 * 100) / 100;

                vars.incomeList.push(
                    {
                        nodeKey: item.key,
                        type: 'Dividends',
                        name: '加权分红',
                        amount: Math.min(perDividendsOfMembers, memberMaxDividends),
                        from: '公司福利',
                        inDate: dateString
                    }
                )
            });
        },
        saveGuideIncome: function (memberKey) {
            var dateString = $filter('date')(formModel.currentDate, 'yyyy-MM-dd');

            var selfOutlayAmount = $scope.query.nodeOutlay(memberKey);
            var selfIncomeAmount = $scope.query.inPoint(memberKey, dateString).amount
                + $scope.query.recommend(memberKey, dateString).amount;
            var selfItem = $filter('filter')(model.members, function (item) {
                return item.key === memberKey
            })[0];

            var parentCalculateAmount = 0;
            if (selfIncomeAmount <= selfOutlayAmount * 0.05) {
                var parent = $filter('filter')(model.members, function (item) { return item.key === selfItem.parentKey })[0];
                if (parent) {
                    parentCalculateAmount = $scope.query.inPoint(parent.key).amount + $scope.query.recommend(parent.key).amount;
                    var counter = 5 - 1, parent = {};
                    while (counter > 0 && !parentCalculateAmount) {
                        if (parentCalculateAmount) {
                            parent = $filter('filter')(model.members, function (item) { return item.key === parent.parentKey })[0];
                            if (parent) {
                                parentCalculateAmount = $scope.query.inPoint(parent.key).amount + $scope.query.recommend(parent.key).amount;
                            }
                            else {
                                break;
                            }
                        }
                        counter--;
                    }
                }
                var enabledVal = parentCalculateAmount * 0.1;
                var siblingChilds = $filter('filter')(model.members, function (item) {
                    return item.parentKey === selfItem.parentKey;
                });
                var siblingOutlayTotal = 0;
                angular.forEach(siblingChilds, function (item) {
                    var siblingIncomeAmount = $scope.query.nodeIncome(item.key, dateString);
                    if (!siblingIncomeAmount) {
                        siblingOutlayTotal += $scope.query.nodeOutlay(item.key)
                    }
                });
                var resultVal = 0;
                if (siblingOutlayTotal) {
                    resultVal = Math.round((enabledVal / siblingOutlayTotal) * selfOutlayAmount * 100) / 100;
                }

                vars.incomeList.push({
                    nodeKey: memberKey,
                    type: 'Guide',
                    name: '辅导奖（互助金）',
                    amount: resultVal,
                    from: parent.key,
                    inDate: dateString
                });
            }
        }
    }

    $scope.query = {
        directNodeList: function (memberKey) {
            return $filter('filter')(vars.releationList,
                function (item) {
                    return item.parentNodeKey === memberKey && item.isDirect === true
                });
        },
        nodeOfChilds: function (memberKey) {
            return $filter('filter')(vars.releationList,
                function (item) {
                    return item.parentNodeKey === memberKey
                });
        },
        nodeIncome: function (memberKey, inDate) {
            var recommendVal = this.recommend(memberKey, inDate).amount;
            var inPointVal = this.inPoint(memberKey, inDate).amount;
            var dividendsVal = this.dividends(memberKey, inDate).amount;
            var guideVal = this.guide(memberKey, inDate).amount;

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
            var childOutlayTotal = 0, maxSelfAmount = selfAmount * 2;

            angular.forEach(childOutlays, function (item) {
                childOutlayTotal += item.amount;
            });

            if (outLaiedChilds.length === 1) {
                maxSelfAmount = selfAmount * 3;
            }
            else if (outLaiedChilds.length === 2) {
                maxSelfAmount = selfAmount * 4;
            }
            else if (outLaiedChilds.length > 2) {
                maxSelfAmount = selfAmount * 5;
            }

            return Math.min(selfAmount * 2 + childOutlayTotal, maxSelfAmount);
        },
        //直推
        recommend: function (memberKey, inDate) {
            // var total = 0;
            // var childOutlays = this.childOutlays(memberKey);

            // for (var i = 0, ii = childOutlays.length; i < ii; i++) {
            //     total += (childOutlays[i].amount * 0.2);//20%
            // }

            // return {
            //     type: 'Recommend',
            //     name: '直推奖',
            //     freezed: false,
            //     amount: total
            // }

            var nodeInComeList = $filter('filter')(vars.incomeList, function (item) {
                return item.nodeKey === memberKey && item.type === 'Recommend';
            });

            if (!!inDate) {
                nodeInComeList = $filter('filter')(nodeInComeList, function (item) {
                    return item.inDate === inDate;
                });
            }

            var total = 0;
            angular.forEach(nodeInComeList, function (item) {
                total += item.amount
            })

            return {
                type: 'Recommend',
                name: '直推奖',
                amount: total
            }
        },
        //见点
        inPoint: function (memberKey, inDate) {
            // var self = this;
            // var config = {
            //     level1: {
            //         layers: [1, 3, 5, 7],
            //         rate: 0.02
            //     },
            //     level2: {
            //         layers: [9, 11, 13],
            //         rate: 0.03
            //     },
            //     level3: {
            //         layers: [15, 17, 19],
            //         rate: 0.04
            //     },
            //     getRate: function (level) {
            //         for (var key in config) {
            //             if (typeof config[key] !== 'function') {
            //                 var levelItem = config[key];
            //                 if (levelItem.layers && levelItem.layers.indexOf(level - 0) >= 0) {
            //                     return levelItem.rate;
            //                 }
            //             }
            //         }
            //     }
            // }
            // var selfAmount = self.nodeOutlay(memberKey);
            // var total = 0,
            //     releationList = $filter('filter')(vars.releationList, function (item) {
            //         return item.parentNodeKey === memberKey;
            //     });

            // angular.forEach(releationList, function (relationItem) {
            //     var rateVal = config.getRate(relationItem.layerNumber);
            //     var childOutlayAmount = self.nodeOutlay(relationItem.nodeKey);
            //     var endlessAmount = Math.min(selfAmount, childOutlayAmount);

            //     if (rateVal) {
            //         total += Math.round(endlessAmount * rateVal)
            //     }
            // });

            var nodeInComeList = $filter('filter')(vars.incomeList, function (item) {
                return item.nodeKey === memberKey && item.type === 'InPoint';
            });

            if (!!inDate) {
                nodeInComeList = $filter('filter')(nodeInComeList, function (item) {
                    return item.inDate === inDate;
                });
            }

            var total = 0;
            angular.forEach(nodeInComeList, function (item) {
                total += item.amount
            })

            return {
                type: 'InPoint',
                name: '见点奖',
                amount: total
            }
        },
        //加权分红
        dividends: function (memberKey, inDate) {
            var nodeInComeList = $filter('filter')(vars.incomeList, function (item) {
                return item.nodeKey === memberKey && item.type === 'Dividends';
            });

            if (!!inDate) {
                nodeInComeList = $filter('filter')(nodeInComeList, function (item) {
                    return item.inDate === inDate;
                });
            }

            var total = 0;
            angular.forEach(nodeInComeList, function (item) {
                total += item.amount
            });

            return {
                type: 'Dividends',
                name: '加权分红',
                amount: total
            }
        },
        //指导奖
        guide: function (memberKey, inDate) {
            // var selfOutlayAmount = this.nodeOutlay(memberKey);
            // var selfIncomeAmount = this.nodeIncome(memberKey);
            // var selfItem = $filter('filter')(model.members, function (item) { return item.key === memberKey })[0];

            // var parentCalculateAmount = 0;
            // if (selfIncomeAmount <= selfOutlayAmount * 0.05) {
            //     var parent = $filter('filter')(model.members, function (item) { return item.key === selfItem.parentKey })[0];
            //     if (parent) {
            //         parentCalculateAmount = this.inPoint(parent.key).amount + this.dividends(parent.key).amount;
            //         var counter = 5 - 1, parent = {};
            //         while (counter > 0 && !parentCalculateAmount) {
            //             if (parentCalculateAmount) {
            //                 parent = $filter('filter')(model.members, function (item) { return item.key === parent.parentKey })[0];
            //                 if (parent) {
            //                     parentCalculateAmount = this.inPoint(parent.key).amount + this.dividends(parent.key).amount;
            //                 }
            //                 else {
            //                     break;
            //                 }
            //             }
            //             counter--;
            //         }
            //     }
            // }

            var nodeInComeList = $filter('filter')(vars.incomeList, function (item) {
                return item.nodeKey === memberKey
                    && item.type === 'Guide';
            });

            if (!!inDate) {
                nodeInComeList = $filter('filter')(nodeInComeList, function (item) {
                    return item.inDate === inDate;
                });
            }

            var total = 0;
            angular.forEach(nodeInComeList, function (item) {
                total += item.amount
            });


            return {
                type: 'Guide',
                name: '辅导奖（互助金）',
                amount: total
            }
        },
        //重复消费
        repeat: function (memberKey) {
            return {
                type: 'Repeat',
                name: '复消提成',
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

            var totalVal = recommendVal + inPointVal + dividendsVal + guideVal + repeatVal;

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
                    type: 'Lock',
                    name: '重消积分（重复消费：6%）',
                    freezed: false,
                    amount: Math.round(enabledVal * 0.06)
                },
                {
                    type: 'Enabled',
                    name: '可用资金',
                    freezed: false,
                    amount: enabledVal - Math.round(enabledVal * 0.2)
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