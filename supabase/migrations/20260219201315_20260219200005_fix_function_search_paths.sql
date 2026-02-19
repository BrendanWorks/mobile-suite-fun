/*
  # Fix Mutable search_path on Functions

  ## Summary
  Three functions in the public schema have a mutable search_path, which can
  allow a malicious user to hijack function calls by creating objects in a
  schema that appears earlier in the path. Setting `search_path = ''` and
  using fully-qualified object names eliminates this attack surface.

  ## Functions Updated
  1. public.get_next_playlist_for_user
  2. public.insert_disordat_puzzle
  3. public.record_disordat_response

  ## Change
  Each function is recreated with `SET search_path = ''` and all table
  references are already schema-qualified (public.*), so behaviour is unchanged.
*/

CREATE OR REPLACE FUNCTION public.get_next_playlist_for_user(user_uuid uuid)
  RETURNS TABLE(playlist_id bigint, playlist_name text, sequence_order integer)
  LANGUAGE plpgsql
  SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.sequence_order
  FROM public.playlists p
  WHERE p.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.game_sessions gs
      WHERE gs.user_id = user_uuid
        AND gs.metadata->>'playlist_id' = p.id::text
        AND gs.completed_at IS NOT NULL
    )
  ORDER BY p.sequence_order
  LIMIT 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.insert_disordat_puzzle(
  p_game_id bigint,
  p_prompt text,
  p_category_1 text,
  p_category_2 text,
  p_items jsonb,
  p_difficulty text DEFAULT 'medium'::text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
  RETURNS bigint
  LANGUAGE plpgsql
  SET search_path = ''
AS $function$
DECLARE
    puzzle_id BIGINT;
    item JSONB;
    item_counter INTEGER := 1;
BEGIN
    INSERT INTO public.puzzles (
        game_id,
        prompt,
        category_1,
        category_2,
        game_type,
        difficulty,
        metadata,
        correct_answer,
        wrong_answers
    ) VALUES (
        p_game_id,
        p_prompt,
        p_category_1,
        p_category_2,
        'disordat',
        p_difficulty,
        p_metadata,
        format('%s vs %s', p_category_1, p_category_2),
        '{}'
    ) RETURNING id INTO puzzle_id;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.puzzle_items (
            puzzle_id,
            item_text,
            correct_category,
            item_order
        ) VALUES (
            puzzle_id,
            item->>'text',
            item->>'category',
            item_counter
        );
        item_counter := item_counter + 1;
    END LOOP;

    RETURN puzzle_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_disordat_response(
  p_user_id uuid,
  p_puzzle_id bigint,
  p_responses jsonb
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SET search_path = ''
AS $function$
DECLARE
    correct_count INTEGER := 0;
    total_count INTEGER := 0;
    response JSONB;
    item_id BIGINT;
    selected_category TEXT;
    correct_category TEXT;
    game_id BIGINT;
    score_percentage INTEGER;
    result JSONB;
BEGIN
    SELECT p.game_id INTO game_id FROM public.puzzles p WHERE p.id = p_puzzle_id;

    FOR response IN SELECT * FROM jsonb_array_elements(p_responses)
    LOOP
        item_id := (response->>'item_id')::BIGINT;
        selected_category := response->>'selected_category';

        SELECT pi.correct_category INTO correct_category
        FROM public.puzzle_items pi
        WHERE pi.id = item_id;

        total_count := total_count + 1;

        IF selected_category = correct_category THEN
            correct_count := correct_count + 1;
        END IF;
    END LOOP;

    score_percentage := CASE
        WHEN total_count > 0 THEN (correct_count * 100 / total_count)
        ELSE 0
    END;

    INSERT INTO public.user_progress (
        user_id,
        game_id,
        puzzle_id,
        score,
        items_attempted,
        items_correct,
        response_data
    ) VALUES (
        p_user_id,
        game_id,
        p_puzzle_id,
        score_percentage,
        total_count,
        correct_count,
        p_responses
    )
    ON CONFLICT (user_id, puzzle_id)
    DO UPDATE SET
        score = EXCLUDED.score,
        items_attempted = EXCLUDED.items_attempted,
        items_correct = EXCLUDED.items_correct,
        response_data = EXCLUDED.response_data,
        completed_at = NOW();

    result := jsonb_build_object(
        'total_items', total_count,
        'correct_items', correct_count,
        'score_percentage', score_percentage,
        'responses', p_responses
    );

    RETURN result;
END;
$function$;
