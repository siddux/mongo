/**
 * Basic tests for the $trim, $ltrim, and $rtrim expressions.
 */
(function() {
"use strict";
load("jstests/aggregation/extras/utils.js");  // For assertErrorCode, testExpression and
                                              // testExpressionWithCollation.
load("jstests/libs/sbe_assert_error_override.js");

const coll = db.trim_expressions;

testExpression(coll, {$trim: {input: " abc "}}, "abc");
testExpression(coll, {$trim: {input: " a b\nc "}}, "a b\nc");
testExpression(coll, {$ltrim: {input: "\t abc "}}, "abc ");
testExpression(coll, {$rtrim: {input: "\t abc "}}, "\t abc");
testExpression(
    coll,
    {$map: {input: {$split: ["4, 5, 6, 7,8,9, 10", ","]}, in : {$trim: {input: "$$this"}}}},
    ["4", "5", "6", "7", "8", "9", "10"]);

// Test that the trim expressions do not respect the collation.
const caseInsensitive = {
    locale: "en_US",
    strength: 2
};
testExpressionWithCollation(coll, {$trim: {input: "xXx", chars: "x"}}, "X", caseInsensitive);
testExpressionWithCollation(coll, {$rtrim: {input: "xXx", chars: "x"}}, "xX", caseInsensitive);
testExpressionWithCollation(coll, {$ltrim: {input: "xXx", chars: "x"}}, "Xx", caseInsensitive);

// Test using inputs from documents.
coll.drop();
assert.commandWorked(coll.insert([
    {_id: 0, name: ", Charlie"},
    {_id: 1, name: "Obama\t,  Barack"},
    {_id: 2, name: " Ride,  Sally   "}
]));

assert.eq(
    coll.aggregate([
            {$sort: {_id: 1}},
            {$project: {firstName: {$trim: {input: {$arrayElemAt: [{$split: ["$name", ","]}, 1]}}}}}
        ])
        .toArray(),
    [{_id: 0, firstName: "Charlie"}, {_id: 1, firstName: "Barack"}, {_id: 2, firstName: "Sally"}]);

coll.drop();
assert.commandWorked(coll.insert([
    {_id: 0, poorlyParsedWebTitle: "The title of my document"},
    {_id: 1, poorlyParsedWebTitle: "\u2001\u2002 Odd unicode indentation"},
    {_id: 2, poorlyParsedWebTitle: "\u2001\u2002 Odd unicode indentation\u200A"},
]));
assert.eq(
    coll.aggregate(
            [{$sort: {_id: 1}}, {$project: {title: {$ltrim: {input: "$poorlyParsedWebTitle"}}}}])
        .toArray(),
    [
        {_id: 0, title: "The title of my document"},
        {_id: 1, title: "Odd unicode indentation"},
        {_id: 2, title: "Odd unicode indentation\u200A"}
    ]);

coll.drop();
assert.commandWorked(coll.insert([
    {_id: 0, proof: "Left as an exercise for the reader∎"},
    {_id: 1, proof: "∎∃ proof∎"},
    {_id: 2, proof: "Just view the problem as a continuous DAG whose elements are taylor series∎"},
    {_id: 3, proof: null},
    {_id: 4},
]));
assert.eq(
    coll.aggregate(
            [{$sort: {_id: 1}}, {$project: {proof: {$rtrim: {input: "$proof", chars: "∎"}}}}])
        .toArray(),
    [
        {_id: 0, proof: "Left as an exercise for the reader"},
        {_id: 1, proof: "∎∃ proof"},
        {
            _id: 2,
            proof: "Just view the problem as a continuous DAG whose elements are taylor series"
        },
        {_id: 3, proof: null},
        {_id: 4, proof: null},
    ]);

// Semantically same as the tests above but non-constant input for 'chars'
coll.drop();
assert.commandWorked(coll.insert([
    {_id: 0, proof: "Left as an exercise for the reader∎", extra: "∎"},
    {_id: 1, proof: "∎∃ proof∎", extra: "∎"},
    {
        _id: 2,
        proof: "Just view the problem as a continuous DAG whose elements are taylor series∎",
        extra: "∎"
    },
    {_id: 3, proof: null},
    {_id: 4},
]));
assert.eq(
    coll.aggregate(
            [{$sort: {_id: 1}}, {$project: {proof: {$rtrim: {input: "$proof", chars: "$extra"}}}}])
        .toArray(),
    [
        {_id: 0, proof: "Left as an exercise for the reader"},
        {_id: 1, proof: "∎∃ proof"},
        {
            _id: 2,
            proof: "Just view the problem as a continuous DAG whose elements are taylor series"
        },
        {_id: 3, proof: null},
        {_id: 4, proof: null},
    ]);

coll.drop();
assert.commandWorked(coll.insert([
    {_id: 0, nonObject: " x "},
    {_id: 1, constantNum: 4},
]));

// Test that errors are reported correctly (for all of $trim, $ltrim, $rtrim).
for (const op of ["$trim", "$ltrim", "$rtrim"]) {
    assertErrorCode(coll, [{$project: {x: {[op]: {}}}}], 50695);
    assertErrorCode(coll, [{$project: {x: {[op]: "$nonObject"}}}], 50696);
    assertErrorCode(coll, [{$project: {x: {[op]: {input: "$constantNum"}}}}], 50699);
    assertErrorCode(
        coll, [{$project: {x: {[op]: {input: {$add: ["$constantNum", "$constantNum"]}}}}}], 50699);
    assertErrorCode(coll, [{$project: {x: {[op]: {input: "$_id"}}}}], 50699);
    assertErrorCode(coll, [{$project: {x: {[op]: {input: "$nonObject", chars: "$_id"}}}}], 50700);
}
}());
