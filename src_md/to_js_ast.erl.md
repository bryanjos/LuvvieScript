   @author    Gordon Guthrie
   @copyright (C) 2013, Gordon Guthrie
   @doc       This module generates the javascript AST
              To see examples of the javascript AST go to
              http://esprima.org/demo/parse.html

   @end
   Created : 17 Aug 2013 by gordon@vixo.com
```erlang
    -module(to_js_ast).

    -export([
             make_erlang_call/3,
             make_comment/3,
             make_apply/2,
             make_return/2,
             make_fail/0,
             make_declarations/2,
             make_array/2,
             make_object/2,
             make_property/3,
             make_block_statement/2,
             make_fn/3,
             make_fn_body/4,
             make_switch/3,
             make_cases/2,
             make_programme/3,
             make_identifier/2,
             make_literal/2,
             make_method/3,
             make_call_expr/3,
             make_operator/4,
             make_expression/2
            ]).

    -include_lib("compiler/src/core_parse.hrl").
    -include("luvviescript.hrl").
    -include("macros.hrl").

```
 Use this definition where you know the source map is humped
 but will need to be fixed up later
%```erlang
```erlang
    make_erlang_call('*', [A, B], Loc) ->
        {A1, B1} = rectify(A, B),
        make_operator("*", A1, B1, Loc);
    make_erlang_call('/', [A, B], Loc) ->
        {A1, B1} = rectify(A, B),
        make_operator("/", A1, B1, Loc);
    make_erlang_call('+', [A, B], Loc) ->
        {A1, B1} = rectify(A, B),
        make_operator("+", A1, B1, Loc);
    make_erlang_call('-', [A, B], Loc) ->
        {A1, B1} = rectify(A, B),
        make_operator("-", A1, B1, Loc).

    rectify(#c_var{name = A}, #c_var{name = B}) ->
        {make_identifier(atom_to_list(A), ?NOSRCMAP),
         make_identifier(atom_to_list(B), ?NOSRCMAP)}.

    make_comment(Comment, Type, Loc) when Type == line orelse Type == block ->
        Type2 = case Type of
                    block -> "Block";
                    line  -> "Line"
                end,
        {obj, lists:flatten([
                             {"type",  enc_v(Type2)},
                             {"value", enc_v(Comment)},
                             Loc
                            ])
        }.

    make_apply(#c_apply{op = Op, args = Args}, Loc) ->
        {Name, _} = Op#c_var.name,
        make_call_expr(make_identifier(atom_to_list(Name), Loc), Args, ?NOSRCMAP).

    make_return(Return, Loc) ->
        {obj, lists:flatten([
                             {"type",     <<"ReturnStatement">>},
                             {"argument", Return},
                             Loc
                            ])
        }.

    make_fail() ->
        make_literal("throw error", ?NOSRCMAP).

    make_declarations(List, Loc) when is_list(List) ->
        Decs = make_decs(List, []),
        {obj, lists:flatten([
                             {"type",         <<"VariableDeclaration">>},
                             {"declarations", Decs},
                             {"kind",         <<"var">>},
                             Loc
                            ])
        }.

    make_decs([], Acc) ->
        lists:reverse(Acc);
    make_decs([{Name, []} | T], Acc) ->
        make_decs([{Name, null} | T], Acc);
    make_decs([{Name, Init} | T], Acc) ->
        NewAcc = {obj, [
                        {"type", <<"VariableDeclarator">>},
                        {"id",   {obj, [
                                        {"type", <<"Identifier">>},
                                        {"name", enc_v(Name)}
                                       ]
                                 }
                        },
                        {"init", Init}
                       ]
                 },
        make_decs(T, [NewAcc | Acc]).

    make_object(List, Loc) when is_list(List) ->
        Properties = [make_property(K, V, ?NOSRCMAP) || {K , V} <- List],
        {obj, lists:flatten([
                             {"type",       <<"ObjectExpression">>},
                             {"properties", Properties},
                             Loc
                            ])
        }.

    make_property(Key, Val, Loc) ->
        {obj, lists:flatten([
                             {"type",  <<"Property">>},
                             {"key",   Key},
                             {"value", Val},
                             {"kind",  <<"init">>},
                             Loc
                            ])
        }.

    make_array(List, Loc) ->
        make_a2(List, Loc, []).

    make_a2([], Loc, Acc) ->
        {obj, lists:flatten([
                             {"type",     <<"ArrayExpression">>},
                             {"elements", lists:reverse(Acc)},
                             Loc
                            ])
        };
    make_a2([H | T], Loc, Acc) ->
        NewAcc = make_literal(H, ?NOSRCMAP),
        make_a2(T, Loc, [NewAcc | Acc]).

    make_block_statement(Block, Loc) when is_list(Block) ->
        {obj,
         lists:flatten([
                        {"type", <<"BlockStatement">>},
                        {"body", Block},
                        Loc
                       ])
        }.

    make_fn(Left, Body, Loc) ->
        _Expr = make_operator("=", Left, Body, Loc).

    make_fn_body(Params, Defaults, Body, Loc) ->
        {obj, lists:flatten([
                             {"type",       <<"FunctionExpression">>},
                             {"id",         null},
                             {"params",     Params},
                             {"defaults",   Defaults},
                             {"body",       Body},
                             {"rest",       null},
                             {"generator",  false},
                             {"expression", false},
                             Loc
                            ])
        }.

    make_switch(Variable, Cases, Loc) ->
        {obj, lists:flatten([
                             {"type",         <<"SwitchStatement">>},
                             {"discriminant", {obj, [
                                                     {"type", <<"Identifier">>},
                                                     {"name", Variable}
                                                    ]
                                              }

                             },
                             {"cases", make_cases(Cases, [])},
                             Loc
                            ])
        }.

    make_cases([], Acc) ->
        lists:reverse(Acc);
    make_cases([{Val, Body, HasBreak} | T], Acc) ->
        Body2 = case HasBreak of
                    true -> Body ++ [
                                     {obj, [
                                            {"type", <<"BreakStatement">>},
                                            {"label", null}
                                           ]
                                     }
                                    ];
                    false -> Body
                end,
        NewAcc = {obj, [
                        {"type",       <<"SwitchCase">>},
                        {"test",       make_literal(Val, [])},
                        {"consequent", Body2}
                       ]
                 },
        make_cases(T, [NewAcc | Acc]).

    make_programme(Comments, Body, Loc) when is_list(Body)     andalso
                                             is_list(Comments) ->
        Com2 = case Comments of
                   "" -> [];
                   _  -> {"comments", Comments}
               end,
        {obj, lists:flatten([
                             {"type", <<"Program">>},
                             Com2,
                             {"body", Body},
                             Loc
                            ])
        }.

    make_identifier(Val, Loc) ->
        {obj, lists:flatten([
                             {"type", <<"Identifier">>},
                             {"name", enc_v(Val)},
                             Loc
                            ])
        }.

    make_literal(null, _Loc) ->
        null;
    make_literal(Val, Loc) when is_integer(Val) ->
        make_l2(Val, Loc);
    make_literal(Val, Loc) when is_float(Val) ->
        make_l2(Val, Loc);
    make_literal(Val, Loc) when is_atom(Val) ->
        Atom2 = make_identifier("atom", Loc),
        Val2 = atom_to_list(Val),
        Literal2 = make_l2(Val2, Loc),
        make_object([{Atom2, Literal2}], Loc);
    make_literal(Val, Loc) when is_list(Val) ->
        make_array(Val, Loc).

    make_l2(Val, Loc) ->
        {obj, lists:flatten([
                             {"type",  <<"Literal">>},
                             {"value", enc_v(Val)},
                             {"raw",   raw_enc_v(Val)},
                             Loc
                            ])
        }.

    make_method(Obj, Fn, Loc) ->
        {obj, lists:flatten([
                             {"type",     <<"MemberExpression">>},
                             {"computed", false},
                             {"object",   {obj, [
                                                 {"type", <<"Identifier">>},
                                                 {"name", enc_v(Obj)}
                                                ]
                                          }
                             },
                             {"property", {obj,
                                           [
                                            {"type", <<"Identifier">>},
                                            {"name", enc_v(Fn)}
                                           ]
                                          }
                             },
                             Loc
                            ])
        }.

    make_call_expr(Callee, Args, Loc) ->
        {obj,
         lists:flatten([
                        {"type",      <<"CallExpression">>},
                        {"callee",    Callee},
                        {"arguments", enc_v(Args)},
                        Loc
                       ])
        }.

    make_operator("=", Left, Right, Loc) ->
        Op = make_op2("=", <<"AssignmentExpression">>, Left, Right, Loc),
        make_expression(Op, ?NOSRCMAP);
    make_operator("*", Left, Right, Loc) ->
        make_op2("*", <<"BinaryExpression">>, Left, Right, Loc);
    make_operator("/", Left, Right, Loc) ->
        make_op2("/", <<"BinaryExpression">>, Left, Right, Loc);
    make_operator("+", Left, Right, Loc) ->
        make_op2("+", <<"BinaryExpression">>, Left, Right, Loc);
    make_operator("-", Left, Right, Loc) ->
        make_op2("-", <<"BinaryExpression">>, Left, Right, Loc).

    make_op2(Operator, OpDesc, Left, Right, Loc) ->
        {obj,
         lists:flatten([
                        {"type",     OpDesc},
                        {"operator", enc_v(Operator)},
                        {"left",     Left},
                        {"right",    Right},
                        Loc
                       ])
        }.

    make_expression(Expr, Loc) ->
        {obj, lists:flatten([
                             {"type",       <<"ExpressionStatement">>},
                             {"expression", Expr},
                             Loc
                            ])
        }.

    raw_enc_v(Str)  when is_list(Str)    -> enc_v("\"" ++ Str ++ "\"");
    raw_enc_v(Atom) when is_atom(Atom)   -> Atom;  %% Todo fix up
    raw_enc_v(Int)  when is_integer(Int) -> list_to_binary(integer_to_list(Int));
    raw_enc_v(Flt)  when is_float(Flt)   ->
        %% definetaly a better way to test this (3.0 = "3")
        Str = case erlang:trunc(Flt) == Flt andalso Flt < 99999 of
                  true  -> integer_to_list(erlang:trunc(Flt));
                  false -> string:to_upper(mochinum:digits(Flt))
              end,
        list_to_binary(Str).

    enc_v([])                         -> [];
    enc_v(Str)   when is_list(Str)    -> list_to_binary(Str);
    enc_v(Atom)  when is_atom(Atom)   -> Atom;
    enc_v(Int)   when is_integer(Int) -> Int;
    enc_v(Flt)   when is_float(Flt)   -> Flt;
    enc_v(Tuple) when is_tuple(Tuple) -> Tuple.

```

 Unit Tests

```erlang

```
-ifdef(TEST).
```erlang
    -include_lib("eunit/include/eunit.hrl").

    log_output(Strap, Got, Expected) ->
        code:add_patha("../deps/rfc4627_jsonrpc/ebin"),
        filelib:ensure_dir("/tmp/js_ast/got.log"),
        %% do the Gots
        GotMsg = io_lib:format(Strap ++ "~n~p~n", [Got]),
        GotJson = rfc4627:encode(Got),
        GotJsonMsg = io_lib:format(Strap ++ " Json~n~s~n", [GotJson]),
        make_utils:plain_log(GotMsg, "/tmp/js_ast/got.log"),
        make_utils:plain_log(GotJsonMsg, "/tmp/js_ast/got.log"),
        %% then do the Exps
        ExpMsg = io_lib:format(Strap ++ "~n~p~n", [Expected]),
        ExpJson = rfc4627:encode(Expected),
        ExpJsonMsg = io_lib:format(Strap ++ " Json~n~s~n", [ExpJson]),
        make_utils:plain_log(ExpMsg, "/tmp/js_ast/exp.log"),
        make_utils:plain_log(ExpJsonMsg, "/tmp/js_ast/exp.log"),
        ok.

    log(Prefix, Term) ->
        filelib:ensure_dir("/tmp/js_ast/debug.log"),
        Msg = io_lib:format(Prefix ++ "~n~p", [Term]),
        make_utils:plain_log(Msg, "/tmp/js_ast/debug.log").

    switch_test_() ->
        Exp = {obj,[{"type",<<"SwitchStatement">>},
                    {"discriminant",{obj,[{"type",<<"Identifier">>},{"name",<<"args">>}]}},
                    {"cases",
                     [{obj,[{"type",<<"SwitchCase">>},
                            {"test",
                             {obj,[{"type",<<"Literal">>},{"value",0},{"raw",<<"0">>}]}},
                            {"consequent",
                             [{obj,[{"type",<<"ExpressionStatement">>},
                                    {"expression",
                                     {obj,[{"type",<<"ArrayExpression">>},
                                           {"elements",
                                            [{obj,[{"type",<<"Literal">>},
                                                   {"value",106},
                                                   {"raw",<<"106">>}]},
                                             {obj,[{"type",<<"Literal">>},
                                                   {"value",101},
                                                   {"raw",<<"101">>}]},
                                             {obj,[{"type",<<"Literal">>},
                                                   {"value",114},
                                                   {"raw",<<"114">>}]},
                                             {obj,[{"type",<<"Literal">>},
                                                   {"value",107},
                                                   {"raw",<<"107">>}]}
                                            ]}
                                          ]}}
                                   ]},
                              {obj,[{"type",<<"BreakStatement">>},{"label",null}]}]}]},
                      {obj,[{"type",<<"SwitchCase">>},
                            {"test",
                             {obj,[{"type",<<"Literal">>},{"value",1},{"raw",<<"1">>}]}},
                            {"consequent",
                             [{obj,[{"type",<<"ExpressionStatement">>},
                                    {"expression",
                                     {obj,[{"type",<<"ArrayExpression">>},
                                           {"elements",
                                            [{obj,[{"type",<<"Literal">>},
                                                   {"value",101},
                                                   {"raw",<<"101">>}]},
                                             {obj,[{"type",<<"Literal">>},
                                                   {"value",114},
                                                   {"raw",<<"114">>}]},
                                             {obj,[{"type",<<"Literal">>},
                                                   {"value",107},
                                                   {"raw",<<"107">>}]}]}]}}]},
                              {obj,[{"type",<<"BreakStatement">>},{"label",null}]}
                             ]}]},
                      {obj,[{"type",<<"SwitchCase">>},
                            {"test",null},
                            {"consequent",
                             [{obj,[{"type",<<"ExpressionStatement">>},
                                    {"expression",
                                     {obj,[{"type",<<"ArrayExpression">>},
                                           {"elements",
                                            [{obj,[{"type",<<"Literal">>},
                                                   {"value",114},
                                                   {"raw",<<"114">>}]},
                                             {obj,[{"type",<<"Literal">>},
                                                   {"value",107},
                                                   {"raw",<<"107">>}]}
                                            ]}
                                          ]}}
                                   ]}
                             ]}
                           ]}
                     ]}
                   ]
              },
        J = make_expression(make_literal("jerk", ?NOSRCMAP), ?NOSRCMAP),
        E = make_expression(make_literal("erk",  ?NOSRCMAP), ?NOSRCMAP),
        R = make_expression(make_literal("rk",   ?NOSRCMAP), ?NOSRCMAP),
        Got = make_switch(<<"args">>, [{0,    [J], ?WITHBREAK},
                                       {1,    [E], ?WITHBREAK},
                                       {null, [R], ?NOBREAK}], ?NOSRCMAP),
        %% log_output("Switch", Got, Exp),
        ?_assertEqual(Got, Exp).

    args_test_() ->
        Exp = {obj,[
                    {"type",<<"ExpressionStatement">>},
                    {"expression",
                     {obj,[
                           {"type",<<"AssignmentExpression">>},
                           {"operator",<<"=">>},
                           {"left",
                            {obj,[
                                  {"type",<<"Identifier">>},
                                  {"name",<<"_args">>}
                                 ]
                            }
                           },
                           {"right",
                            {obj,[
                                  {"type",<<"CallExpression">>},
                                  {"callee",
                                   {obj,[
                                         {"type",<<"MemberExpression">>},
                                         {"computed",false},
                                         {"object",
                                          {obj,[
                                                {"type",<<"Identifier">>},
                                                {"name",<<"arguments">>}
                                               ]
                                          }
                                         },
                                         {"property",
                                          {obj,[
                                                {"type",<<"Identifier">>},
                                                {"name",<<"length">>}
                                               ]
                                          }
                                         }
                                        ]
                                   }
                                  },
                                  {"arguments", []}
                                 ]
                            }
                           }
                          ]
                     }
                    }
                   ]
              },
        Left   = make_identifier("_args", ?NOSRCMAP),
        Method = make_method("arguments", "length", ?NOSRCMAP),
        Right  = make_call_expr(Method, [], ?NOSRCMAP),
        Got    = make_operator("=", Left, Right, ?NOSRCMAP),
        %% log_output("Args", Got, Exp),
        ?_assertEqual(Got, Exp).

    fns_test_() ->
        Exp = {obj,
               [
                {"type",<<"ExpressionStatement">>},
                {"expression",
                 {obj,
                  [
                   {"type",<<"AssignmentExpression">>},
                   {"operator",<<"=">>},
                   {"left",
                    {obj,
                     [
                      {"type",<<"Identifier">>},
                      {"name",<<"simplefn">>}
                     ]}},
                   {"right",
                    {obj,
                     [
                      {"type",<<"FunctionExpression">>},
                      {"id",null},
                      {"params",[]},
                      {"defaults",[]},
                      {"body",
                       {obj,
                        [
                         {"type",<<"BlockStatement">>},
                         {"body",
                          [
                           {obj,
                            [
                             {"type",<<"ReturnStatement">>},
                             {"argument",
                              {obj,
                               [{"type",<<"Literal">>},
                                {"value",111},
                                {"raw",<<"111">>}
                               ]}}
                            ]}
                          ]}
                        ]}},
                      {"rest",null},
                      {"generator",false},
                      {"expression",false}
                     ]}}
                  ]}}
               ]},
        FnName   = make_identifier("simplefn", ?NOSRCMAP),
        Params   = ?EMPTYJSONLIST,
        Defaults = ?EMPTYJSONLIST,
        Literal  = make_literal(111, ?NOSRCMAP),
        Return   = make_return(Literal, ?NOSRCMAP),
        Body     = make_block_statement([Return], ?NOSRCMAP),
        FnBody   = make_fn_body(Params, Defaults, Body, ?NOSRCMAP),
        Got      = make_fn(FnName, FnBody, ?NOSRCMAP),
        %% log_output("Fns", Got, Exp),
        ?_assertEqual(Got, Exp).

    return_test_() ->
        %% var fn = function () {
        %% 	var a;
        %% 	var b;
        %% 	a = 1;
        %% 	b = 2;
        %% 	return a/b;
        %% 	}
        Exp = {obj,
               [{"type",<<"ExpressionStatement">>},
                {"expression",
                 {obj,
                  [{"type",<<"AssignmentExpression">>},
                   {"operator",<<"=">>},
                   {"left",{obj,[{"type",<<"Identifier">>},{"name",<<"fn">>}]}},
                   {"right",
                    {obj,
                     [{"type",<<"FunctionExpression">>},
                      {"id",null},
                      {"params",[]},
                      {"defaults",[]},
                      {"body",
                       {obj,
                        [{"type",<<"BlockStatement">>},
                         {"body",
                          [{obj,
                            [{"type",<<"VariableDeclaration">>},
                             {"declarations",
                              [{obj,
                                [{"type",<<"VariableDeclarator">>},
                                 {"id",{obj,[{"type",<<"Identifier">>},{"name",<<"a">>}]}},
                                 {"init",null}]}]},
                             {"kind",<<"var">>}]},
                           {obj,
                            [{"type",<<"VariableDeclaration">>},
                             {"declarations",
                              [{obj,
                                [{"type",<<"VariableDeclarator">>},
                                 {"id",{obj,[{"type",<<"Identifier">>},{"name",<<"b">>}]}},
                                 {"init",null}]}]},
                             {"kind",<<"var">>}]},
                           {obj,
                            [{"type",<<"ExpressionStatement">>},
                             {"expression",
                              {obj,
                               [{"type",<<"AssignmentExpression">>},
                                {"operator",<<"=">>},
                                {"left",{obj,[{"type",<<"Identifier">>},{"name",<<"a">>}]}},
                                {"right",
                                 {obj,
                                  [{"type",<<"Literal">>},
                                   {"value",1},
                                   {"raw",<<"1">>}]}}]}}]},
                           {obj,
                            [{"type",<<"ExpressionStatement">>},
                             {"expression",
                              {obj,
                               [{"type",<<"AssignmentExpression">>},
                                {"operator",<<"=">>},
                                {"left",{obj,[{"type",<<"Identifier">>},{"name",<<"b">>}]}},
                                {"right",
                                 {obj,
                                  [{"type",<<"Literal">>},
                                   {"value",2},
                                   {"raw",<<"2">>}]}}]}}]},
                           {obj,
                            [{"type",<<"ReturnStatement">>},
                             {"argument",
                              {obj,
                               [{"type",<<"BinaryExpression">>},
                                {"operator",<<"/">>},
                                {"left",{obj,[{"type",<<"Identifier">>},{"name",<<"a">>}]}},
                                {"right",
                                 {obj,
                                  [{"type",<<"Identifier">>},{"name",<<"b">>}]}}]}}]}]}]}},
                      {"rest",null},
                      {"generator",false},
                      {"expression",false}]}}]}}]},

        FnName   = make_identifier("fn", ?NOSRCMAP),
        Params   = ?EMPTYJSONLIST,
        Defaults = ?EMPTYJSONLIST,
        Decls = lists:flatten([
                               make_declarations([{"a", ?NOTINITIALISED}], ?NOSRCMAP),
                               make_declarations([{"b", ?NOTINITIALISED}], ?NOSRCMAP)
                              ]),
        A1 = make_identifier("a", ?NOSRCMAP),
        B1 = make_identifier("b", ?NOSRCMAP),
        Ass1 = make_operator("=", A1, make_literal(1, ?NOSRCMAP), ?NOSRCMAP),
        Ass2 = make_operator("=", B1, make_literal(2, ?NOSRCMAP), ?NOSRCMAP),
        Expr    = make_operator("/", A1, B1, ?NOSRCMAP),
        Return  = make_return(Expr, ?NOSRCMAP),
        Body    = make_block_statement(lists:flatten([Decls, Ass1, Ass2, Return]),
                                       ?NOSRCMAP),
        FnBody  = make_fn_body(Params, Defaults, Body, ?NOSRCMAP),
        Got     = make_fn(FnName, FnBody, ?NOSRCMAP),
        %% log_output("Fns", Got, Exp),
        ?_assertEqual(Got, Exp).

    declarations_test_() ->
        Exp = [{obj,[{"type",<<"VariableDeclaration">>},
                     {"declarations",
                      [{obj,[{"type",<<"VariableDeclarator">>},
                             {"id",{obj,[{"type",<<"Identifier">>},{"name",<<"a">>}]}},
                             {"init",null}]}]},
                     {"kind",<<"var">>}]},
               {obj,[{"type",<<"VariableDeclaration">>},
                     {"declarations",
                      [{obj,[{"type",<<"VariableDeclarator">>},
                             {"id",{obj,[{"type",<<"Identifier">>},{"name",<<"b">>}]}},
                             {"init",null}]}]},
                     {"kind",<<"var">>}]}],
        Got = [
               make_declarations([
                                  {"a", ?NOTINITIALISED}
                                 ], ?NOSRCMAP),
               make_declarations([
                                  {"b", ?NOTINITIALISED}
                                 ], ?NOSRCMAP)
              ],
        %% log_output("Declarations", Got, Exp),
        ?_assertEqual(Got, Exp).

    fncall_test_() ->
        %% somefn = function() {
        %%	   return anotherfn();
        %% }
        Exp = {obj,
               [{"type",<<"ExpressionStatement">>},
                {"expression",
                 {obj,
                  [{"type",<<"AssignmentExpression">>},
                   {"operator",<<"=">>},
                   {"left",{obj,[{"type",<<"Identifier">>},{"name",<<"somefn">>}]}},
                   {"right",
                    {obj,
                     [{"type",<<"FunctionExpression">>},
                      {"id",null},
                      {"params",[]},
                      {"defaults",[]},
                      {"body",
                       {obj,
                        [{"type",<<"BlockStatement">>},
                         {"body",
                          [{obj,
                            [{"type",<<"ReturnStatement">>},
                             {"argument",
                              {obj,
                               [{"type",<<"CallExpression">>},
                                {"callee",
                                 {obj,
                                  [{"type",<<"Identifier">>},{"name",<<"anotherfn">>}]}},
                                {"arguments",[]}]}}]}]}]}},
                      {"rest",null},
                      {"generator",false},
                      {"expression",false}]}}]}}]},
        Left   = make_identifier("somefn", ?NOSRCMAP),
        Right  = make_call_expr(make_identifier("anotherfn", ?NOSRCMAP), [], ?NOSRCMAP),
        Return = make_return(Right, ?NOSRCMAP),
        Block  = make_block_statement([Return], ?NOSRCMAP),
        Body   = make_fn_body([], [], Block, ?NOSRCMAP),
        Got    = make_fn(Left, Body, ?NOSRCMAP),
        %% log_output("Fn Call", Got, Exp),
        ?_assertEqual(Got, Exp).

    array_test_() ->

        Exp = {obj,[{"type",<<"ArrayExpression">>},
                    {"elements",
                     [{obj,[{"type",<<"Literal">>},{"value",1},{"raw",<<"1">>}]},
                      {obj,[{"type",<<"Literal">>},{"value",2},{"raw",<<"2">>}]},
                      {obj,[{"type",<<"Literal">>},{"value",3},{"raw",<<"3">>}]},
                      {obj,[{"type",<<"Literal">>},{"value",4},{"raw",<<"4">>}]}]}]},
        Got = make_array([1, 2, 3, 4], ?NOSRCMAP),
        %% log_output("Array", Got, Exp),
        ?_assertEqual(Got, Exp).

    object_test_() ->
        Exp = {obj,[{"type",<<"ObjectExpression">>},
                    {"properties",
                     [{obj,[{"type",<<"Property">>},
                            {"key",{obj,[{"type",<<"Identifier">>},{"name",<<"atom">>}]}},
                            {"value",
                             {obj,[{"type",<<"Literal">>},
                                   {"value",<<"berk">>},
                                   {"raw",<<"\"berk\"">>}]}},
                            {"kind",<<"init">>}]}]}]},
        Got = make_literal(berk, ?NOSRCMAP),
        %% log_output("Atom", Got, Exp),
        ?_assertEqual(Got, Exp).

```
Mod.Fn = function () {
	return "erk";
	}
```erlang
    mod_fn_test_() ->
        Exp = [
               {obj,
                [{"type",<<"ExpressionStatement">>},
                 {"expression",
                  {obj,
                   [{"type",<<"AssignmentExpression">>},
                    {"operator",<<"=">>},
                    {"left",
                     {obj,
                      [{"type",<<"MemberExpression">>},
                       {"computed",false},
                       {"object",{obj,[{"type",<<"Identifier">>},{"name",<<"Mod">>}]}},
                       {"property",
                        {obj,[{"type",<<"Identifier">>},{"name",<<"Fn">>}]}}]}},
                    {"right",
                     {obj,
                      [{"type",<<"FunctionExpression">>},
                       {"id",null},
                       {"params",[]},
                       {"defaults",[]},
                       {"body",
                        {obj,
                         [{"type",<<"BlockStatement">>},
                          {"body",
                           [{obj,
                             [{"type",<<"ReturnStatement">>},
                              {"argument",
                               {obj,
                                [{"type",<<"Literal">>},
                                 {"value",<<"erk">>},
                                 {"raw",<<"\"erk\"">>}]}}]}]}]}},
                       {"rest",null},
                       {"generator",false},
                       {"expression",false}]}}]}}]}
              ],
        FnName   = make_identifier("Fn", ?NOSRCMAP),
        Params   = ?EMPTYJSONLIST,
        Defaults = ?EMPTYJSONLIST,
        Literal  = make_literal("erk", ?NOSRCMAP),
        Return   = make_return(Literal, ?NOSRCMAP),
        Body     = make_block_statement([Return], ?NOSRCMAP),
        FnBody   = make_fn_body(Params, Defaults, Body, ?NOSRCMAP),
        Fn       = make_fn(FnName, FnBody, ?NOSRCMAP),
        Got      = make_method("Mod", Fn, ?NOSRCMAP),
        log_output("Mod:Fn", Got, Exp),
        ?_assertEqual(Got, Exp).

```
-endif.
