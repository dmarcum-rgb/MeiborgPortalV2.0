/*
  # Seed debt_loans from January 2026 Debt Schedule

  Populates the debt_loans table with all loans from the AIDEBT Debt Schedule CSV
  as of January 31, 2026 snapshot. Each row represents one loan/tranche.
  Tab ID: a0de002f-6c3a-4ebd-a3c6-a5b0c689355d (Debts tab in Accounting Projects folder).
*/

DO $$
DECLARE
  v_tab_id uuid := 'a0de002f-6c3a-4ebd-a3c6-a5b0c689355d';
BEGIN
  -- Only seed if the tab exists and no data loaded yet
  IF EXISTS (SELECT 1 FROM portal_tabs WHERE id = v_tab_id)
     AND NOT EXISTS (SELECT 1 FROM debt_loans WHERE tab_id = v_tab_id) THEN

    INSERT INTO debt_loans (tab_id, lender, loan_number, description, entity, balance, origination_date, maturity_date, term_months, interest_rate, monthly_payment, beginning_balance, loan_type, unit_numbers, auto_pull, sort_order) VALUES

    -- Wintrust
    (v_tab_id, 'Wintrust', '08-2911-000-000-00', 'Rockford SBA - 1122 Milford Road', 'MH1', 1574131.66, '2020-12-17', '2046-04-01', 300, 0.0361, 9485.77, 1820000.00, 'Debt', '', false, 10),

    -- BMO
    (v_tab_id, 'BMO', '05-2938-000-000-00', '25 Trailers', 'Logistics', 113042.42, '2019-03-12', '2026-09-01', 89, 0.0380, 14022.38, 996652.50, 'Debt', '53337-53361', true, 20),
    (v_tab_id, 'BMO', '05-2948-000-000-00', '27 Trailers', 'Logistics', 180803.80, '2019-10-01', '2027-01-01', 84, 0.0370, 14430.53, 1066160.00, 'Debt', '53387-53413', true, 21),
    (v_tab_id, 'BMO', '05-2929-000-000-00', '25 Trailers', 'Logistics', 250670.38, '2020-09-03', '2027-09-03', 84, 0.0370, 12945.01, 956375.00, 'Debt', '53414-53438', false, 22),
    (v_tab_id, 'BMO', '05-2934-002-000-00', '2 T680 Sleepers', 'Logistics', 129875.15, '2022-07-29', '2028-02-01', 66, 0.0445, 5439.99, 317570.00, 'Debt', '609 & 610', false, 23),
    (v_tab_id, 'BMO', '05-2934-001-000-00', '5 T680 Sleepers', 'Logistics', 327541.09, '2022-08-05', '2028-02-10', 66, 0.0442, 13666.65, 798925.00, 'Debt', '611, 614, 615, 616, 617', false, 24),
    (v_tab_id, 'BMO', '05-2934-003-000-00', '5 T680 Daycabs', 'Logistics', 467741.88, '2023-05-12', '2028-12-01', 66, 0.0599, 14602.40, 816500.00, 'Debt', '657, 658, 659, 660, 661', false, 25),
    (v_tab_id, 'BMO', '05-2934-004-000-00', '1 579 Peterbilt', 'Logistics', 107667.93, '2023-05-16', '2028-12-01', 66, 0.0599, 3371.19, 188397.73, 'Debt', '668', false, 26),
    (v_tab_id, 'BMO', '05-2934-005-000-00', '3 579 Peterbilts', 'Logistics', 333804.46, '2023-06-15', '2029-01-01', 66, 0.0639, 10209.23, 564293.19, 'Debt', '669-671', false, 27),
    (v_tab_id, 'BMO', '05-2934-006-000-00', '1 579 Peterbilt', 'Logistics', 111405.33, '2023-07-06', '2029-01-10', 66, 0.0668, 3421.33, 188107.73, 'Debt', '672', false, 28),
    (v_tab_id, 'BMO', '05-2934-007-000-00', '6 T680 Sleepers', 'Logistics', 651991.04, '2023-07-17', '2029-02-01', 66, 0.0668, 19542.15, 1073840.00, 'Debt', '677, 679-683', false, 29),

    -- Webster Capital Finance
    (v_tab_id, 'Webster Capital Finance', '05-2939-001-000-00', '3 Freightliner Daycabs', 'Logistics', 67275.73, '2021-09-14', '2027-06-21', 69, 0.0272, 4156.50, 386346.50, 'Debt', '552, 553, 554', true, 30),
    (v_tab_id, 'Webster Capital Finance', '05-2939-000-000-00', '25 Trailers', 'Logistics', 159822.26, '2019-06-20', '2027-01-02', 90, 0.0401, 13579.40, 981215.00, 'Capital Lease', '53362-53386', false, 31),
    (v_tab_id, 'Webster Capital Finance', '05-2939-002-000-00', '25 Trailers', 'Logistics', 547954.43, '2021-11-08', '2029-02-08', 87, 0.0298, 15519.44, 1166450.00, 'Debt', '53514-53538', false, 32),
    (v_tab_id, 'Webster Capital Finance', '05-2939-003-000-00', '30 Trailers', 'Logistics', 1132276.57, '2022-06-15', '2029-09-15', 87, 0.0437, 27900.53, 1993260.00, 'Debt', '53564-53593', false, 33),
    (v_tab_id, 'Webster Capital Finance', '05-2939-005-000-00', '7 T680 Trucks', 'Logistics', 761128.30, '2023-03-29', '2028-12-29', 69, 0.0572, 15902.49, 1238790.00, 'Debt', '650-656', false, 34),
    (v_tab_id, 'Webster Capital Finance', '05-2939-006-000-00', '25 Trailers', 'Logistics', 1092636.63, '2023-04-21', '2030-07-21', 69, 0.0615, 23238.84, 1557625.00, 'Debt', '53631, 53636, 53646-53668', false, 35),

    -- Paccar
    (v_tab_id, 'Paccar', '05-2956-000-000-00', '15 Kenworth T-680', 'Logistics', 15594.25, '2020-12-22', '2026-10-05', 69, 0.0297, 1861.62, 2090725.00, 'Debt', '520-534', false, 40),
    (v_tab_id, 'Paccar', '05-2957-000-000-00', 'Kenworth T880 Wrecker', 'Logistics', 45884.16, '2020-01-14', '2026-10-28', 69, 0.0297, 5238.02, 314075.00, 'Debt', 'Enterprise Wrecker', false, 41),
    (v_tab_id, 'Paccar', '05-2958-000-000-00', '4 T880 Day Cabs', 'Logistics', 69233.26, '2021-07-22', '2027-02-05', 69, 0.0275, 4454.19, 537800.00, 'Debt', '542-545', false, 42),
    (v_tab_id, 'Paccar', '05-2959-001-000-00', '1 T880 & 1 T680', 'Logistics', 75559.17, '2021-08-17', '2027-06-01', 69, 0.0276, 4576.96, 276325.00, 'Debt', '547 (T880) & 548 (T680)', false, 43),
    (v_tab_id, 'Paccar', '05-2959-002-000-00', '1 T680', 'Logistics', 40446.60, '2021-09-29', '2027-07-12', 69, 0.0283, 2362.52, 141875.00, 'Debt', '551', false, 44),
    (v_tab_id, 'Paccar', '05-2959-003-000-00', '3 T680', 'Logistics', 40446.60, '2021-10-07', '2027-07-21', 69, 0.0279, 7087.77, 428375.00, 'Debt', '555, 556, 557', false, 45),
    (v_tab_id, 'Paccar', '05-2959-004-000-00', '1 T680', 'Logistics', 43181.20, '2021-10-19', '2027-08-03', 69, 0.0279, 2361.89, 141875.00, 'Debt', '558', false, 46),
    (v_tab_id, 'Paccar', '05-2959-005-000-00', '1 T680', 'Logistics', 45421.38, '2021-11-19', '2027-09-03', 69, 0.0279, 2361.14, 141875.00, 'Debt', '560', false, 47),
    (v_tab_id, 'Paccar', '05-2959-006-000-00', '2 T680', 'Logistics', 91105.59, '2021-12-07', '2027-09-21', 69, 0.0279, 4701.06, 283750.00, 'Debt', '562 & 563', false, 48),
    (v_tab_id, 'Paccar', '05-2959-007-000-00', '1 T680', 'Logistics', 48119.99, '2021-12-28', '2027-10-10', 69, 0.0279, 2383.09, 143250.00, 'Debt', '564', false, 49),
    (v_tab_id, 'Paccar', '05-2959-008-000-00', '5 T680', 'Logistics', 389178.82, '2022-09-23', '2028-07-07', 69, 0.0494, 14084.55, 800175.00, 'Debt', '619, 620, 622-624', false, 50),
    (v_tab_id, 'Paccar', '05-2959-009-000-00', '3 T680', 'Logistics', 242292.39, '2022-10-17', '2028-08-01', 69, 0.0494, 8510.59, 483105.00, 'Debt', '621, 625, 626', true, 51),
    (v_tab_id, 'Paccar', '05-2959-010-000-00', '2 T680', 'Logistics', 163684.52, '2022-10-26', '2028-08-10', 69, 0.0494, 5657.19, 320820.00, 'Debt', '627 & 628', false, 52),
    (v_tab_id, 'Paccar', '05-2959-011-000-00', '2 T680', 'Logistics', 164840.38, '2022-11-22', '2028-09-06', 69, 0.0494, 5632.49, 319570.00, 'Debt', '630 & 631', false, 53),
    (v_tab_id, 'Paccar', '05-2959-012-000-00', '3 T680', 'Logistics', 252050.13, '2022-12-07', '2028-09-21', 69, 0.0494, 8443.54, 479355.00, 'Debt', '629, 632, 633', false, 54),
    (v_tab_id, 'Paccar', '05-2959-013-000-00', '3 T680', 'Logistics', 251696.50, '2022-12-16', '2028-09-30', 69, 0.0494, 8443.54, 479355.00, 'Debt', '634, 635, 636', false, 55),
    (v_tab_id, 'Paccar', '05-2959-014-000-00', '7 T680', 'Logistics', 788085.91, '2023-05-24', '2028-03-08', 69, 0.0636, 22964.37, 1252080.00, 'Debt', '662-665, 667, 673, 674', false, 56),
    (v_tab_id, 'Paccar', '05-2959-015-000-00', '2 T680', 'Logistics', 220994.62, '2023-06-08', '2024-03-23', 69, 0.0650, 6610.54, 358370.00, 'Debt', '675, 676', true, 57),
    (v_tab_id, 'Paccar', '05-2959-017-000-00', '7 T680', 'Logistics', 971726.20, '2024-01-29', '2029-11-11', 69, 0.0658, 23966.36, 1298710.00, 'Debt', '719-721 & 723-726', false, 58),
    (v_tab_id, 'Paccar', '05-2959-016-000-00', '5 Peterbilt 579s', 'Logistics', 708370.96, '2024-01-31', '2029-11-16', 69, 0.0658, 17475.84, 946797.30, 'Debt', '734-738', false, 59),
    (v_tab_id, 'Paccar', '05-2959-018-000-00', '8 T680', 'Logistics', 1132032.18, '2024-02-22', '2029-12-07', 69, 0.0662, 27417.44, 1484240.00, 'Debt', '722, 727-733', false, 60),
    (v_tab_id, 'Paccar', '05-2959-019-000-00', '5 Peterbilt 579s', 'Logistics', 722088.89, '2024-02-27', '2029-12-13', 69, 0.0662, 17494.31, 946797.30, 'Debt', '739-743', false, 61),

    -- Wells Fargo
    (v_tab_id, 'Wells Fargo', '05-2942-000-000-00', '40 Trailers (53181-53220)', 'Logistics', 28533.09, '2017-06-21', '2026-01-21', 103, 0.0437, 16196.39, 1414140.00, 'Capital Lease', '40 Trailers 53181-53220', true, 70),
    (v_tab_id, 'Wells Fargo', '05-2943-000-000-00', '35 Trailers (53221-53255)', 'Logistics', 37508.52, '2017-07-31', '2026-02-28', 103, 0.0437, 14085.87, 1248367.75, 'Capital Lease', '35 Trailers 53221-53255', true, 71),
    (v_tab_id, 'Wells Fargo', '05-2945-000-000-00', '27 Trailers (53258-53282)', 'Logistics', 124499.38, '2018-04-13', '2025-07-23', 87, 0.0472, 11128.29, 920656.00, 'Capital Lease', '53258-53282', true, 72),

    -- Huntington
    (v_tab_id, 'Huntington', '05-2961-001-000-00', '5 Sleepers', 'Logistics', 283482.83, '2022-03-03', '2027-09-03', 66, 0.0307, 12716.26, 770340.00, 'Debt', '577-581', false, 80),
    (v_tab_id, 'Huntington', '05-2961-002-000-00', '25 Trailers', 'Logistics', 742310.69, '2022-03-18', '2029-03-17', 84, 0.0316, 19136.97, 1438050.00, 'Debt', '53539-53563', false, 81),
    (v_tab_id, 'Huntington', '05-2961-003-000-00', '1 T880 DC & 3 T680 SLPR', 'Logistics', 192964.73, '2022-05-03', '2027-11-03', 66, 0.0414, 8077.88, 626090.00, 'Debt', '587-590', false, 82),
    (v_tab_id, 'Huntington', '05-2961-004-000-00', '3 T880 DC & 1 T680 SLPR', 'Logistics', 245844.48, '2022-05-18', '2027-11-18', 66, 0.0418, 10288.73, 605160.00, 'Debt', '591-594', false, 83),
    (v_tab_id, 'Huntington', '05-2961-005-000-00', '2 T880 DC', 'Logistics', 124649.77, '2022-06-01', '2027-12-01', 66, 0.0397, 5014.54, 296410.00, 'Debt', '596 & 597', false, 84),

    -- Ascentium
    (v_tab_id, 'Ascentium', '01-2986-000-000-00', '5 Trailers - Texas 393', 'Bros', 224949.83, '2025-06-30', '2030-06-01', 60, 0.0835, 5089.58, 272877.70, 'Debt', '', false, 90),
    (v_tab_id, 'Ascentium', '01-2987-000-000-00', '5 Trailers - Texas 489', 'Bros', 224648.19, '2025-07-01', '2030-06-15', 60, 0.0837, 5084.70, 272500.00, 'Debt', '', false, 91),

    -- Amur
    (v_tab_id, 'Amur', '01-2984-000-000-00', '10 Tanker Pumps', 'Bros', 64230.21, '2025-09-01', '2031-08-01', 72, 0.1075, 1279.13, 67656.25, 'Debt', '', false, 100),

    -- Daimler
    (v_tab_id, 'Daimler', '02-2920-000-080-00', '2 KW W900L 2022', 'WHS', 226320.61, '2025-10-04', '2029-09-04', 48, 0.1299, 6523.75, 241972.52, 'Debt', '828-829', false, 110),

    -- JX Financial
    (v_tab_id, 'JX Financial', '05-2989-000-000-00', '50 Trailers 53719-53768', 'Logistics', 2345387.82, '2025-10-23', '2031-09-23', 72, 0.0925, 44443.39, 2438820.00, 'Debt', '53719-53768', false, 120),

    -- CCG - Commercial Credit Group
    (v_tab_id, 'CCG - Commercial Credit Group', '05-2990-000-000-00', '5 Trucks 809-813', 'Logistics', 863271.63, '2025-11-10', '2030-08-10', 58, 0.1050, 20250.00, 940000.00, 'Debt', '809-813', false, 130),
    (v_tab_id, 'CCG - Commercial Credit Group', '05-2990-001-000-00', '6 Trucks 814-819', 'Logistics', 1035943.23, '2025-11-10', '2030-08-10', 58, 0.1050, 24291.00, 1128000.00, 'Debt', '814-819', false, 131),
    (v_tab_id, 'CCG - Commercial Credit Group', '05-2990-002-000-00', '6 Trucks 820-825', 'Logistics', 1035943.23, '2025-11-10', '2030-08-10', 58, 0.1050, 24291.00, 1128000.00, 'Debt', '820-825', false, 132),

    -- FPG
    (v_tab_id, 'FPG', '07-2920-000-104-00', 'Houston WHS Container Forklift', 'WHS', 28090.45, '2025-08-16', '2028-08-01', 36, 0.1056, 1064.65, 31948.58, 'Debt', '', false, 140),

    -- Bank of America
    (v_tab_id, 'Bank of America', '01-2925-000-000-00', '2024 Corvette', 'Bros', 73722.17, '2024-02-01', '2028-02-01', 48, 0.0829, 3481.99, 136493.42, 'Debt', 'Zach''s Corvette', false, 150),

    -- International Financial - Navistar
    (v_tab_id, 'International Financial - Navistar', '05-2988-000-000-00', '8 International Trucks 801-808', 'Logistics', 1417675.41, '2025-07-11', '2031-02-11', 67, 0.0799, 25670.35, 1512353.32, 'Debt', '801-808', false, 160),
    (v_tab_id, 'International Financial - Navistar', '05-2988-001-000-00', '17 International Trucks 809-825 (Service Contract)', 'Logistics', 316636.90, '2025-11-03', '1930-10-03', 60, 0.0000, 5555.03, 333302.00, 'Debt', '809-825', false, 161),

    -- Mercedes
    (v_tab_id, 'Mercedes', '05-2991-000-000-00', 'Zach Mercedes', 'Logistics', 95162.91, '2025-11-03', '2030-10-03', 60, 0.0399, 1838.50, 99690.00, 'Debt', 'Zach Mercedes', false, 170),

    -- GM Financial
    (v_tab_id, 'GM Financial', '01-2983-000-000-00', '2020 GMC Sierra 3500HD', 'Bros', 98295.04, '2025-10-23', '2031-10-07', 72, 0.0890, 1847.99, 100423.71, 'Debt', '', false, 180),

    -- First Commonwealth
    (v_tab_id, 'First Commonwealth', '01-2982-000-000-00', '2021 Lowboy Vin 1068838', 'Bros', 80448.94, '2026-01-08', '2031-12-08', 72, 0.0955, 1487.45, 81289.59, 'Debt', '', false, 190),

    -- Signature Bank (Flagstar)
    (v_tab_id, 'Signature Bank (Flagstar)', '05-2981-000-000-00', '25 Trailers', 'Logistics', 276918.59, '2020-11-05', '2027-11-05', 84, 0.0358, 13061.21, 966525.00, 'Debt', '53439-53463', false, 200),

    -- NBH Bank (Midwest)
    (v_tab_id, 'NBH Bank (Midwest)', '05-2982-000-000-00', '25 Trailers', 'Logistics', 303649.48, '2020-11-20', '2027-11-20', 84, 0.0360, 13836.24, 966475.00, 'Debt', '53464-53488', false, 210),

    -- Peoples Bank (M&T)
    (v_tab_id, 'Peoples Bank (M&T)', '05-2983-000-000-00', '25 Trailers', 'Logistics', 323999.28, '2020-12-29', '2028-03-29', 87, 0.0340, 12941.28, 966175.00, 'Debt', '53489-53513', false, 220),
    (v_tab_id, 'Peoples Bank (M&T)', '05-2983-001-000-00', '25 Trailers 115024', 'Logistics', 1394900.00, '2026-01-21', '2031-01-21', 60, 0.0770, 28154.00, 1689240.00, 'Debt', '', false, 221),

    -- Peapack Capital
    (v_tab_id, 'Peapack Capital', '05-2984-002-000-00', '5 Sleepers', 'Logistics', 237858.40, '2022-02-18', '2027-08-18', 66, 0.0289, 12823.35, 781635.00, 'Debt', '572-576', false, 230),
    (v_tab_id, 'Peapack Capital', '05-2984-004-000-00', '1 Autocar Spotter', 'Logistics', 39031.15, '2022-05-27', '2027-05-26', 60, 0.0438, 2499.85, 134500.00, 'Debt', '603', false, 231),
    (v_tab_id, 'Peapack Capital', '05-2984-009-000-00', '1 Electric Forklift', 'Logistics', 18179.64, '2024-07-03', '2027-07-03', 36, 0.0726, 1066.94, 34423.50, 'Debt', 'TX WHS', false, 232),
    (v_tab_id, 'Peapack Capital', '05-2986-001-000-00', '25 Trailers (53694-53718)', 'Logistics', 1068861.20, '2024-07-22', '2031-07-22', 84, 0.0619, 19147.18, 1302600.00, 'Debt', '53694-53718', false, 233),

    -- TriState Capital
    (v_tab_id, 'TriState Capital', '05-2985-000-000-00', '2 T680 Sleepers', 'Logistics', 129767.79, '2022-08-16', '2028-02-15', 66, 0.0448, 5435.69, 317570.00, 'Debt', '612 & 613', false, 240),
    (v_tab_id, 'TriState Capital', '05-2985-001-000-00', '25 Trailers (53594-53618)', 'Logistics', 994690.80, '2022-10-13', '2029-11-15', 84, 0.0495, 24218.15, 1716800.00, 'Debt', '53594-53618', false, 241),
    (v_tab_id, 'TriState Capital', '05-2985-002-000-00', '3 Peterbilts 579 (637-639)', 'Logistics', 308599.20, '2023-02-03', '2028-08-01', 66, 0.0535, 10672.83, 609514.20, 'Debt', '637-639', false, 242),
    (v_tab_id, 'TriState Capital', '05-2985-003-000-00', '2 Peterbilts 579 (640-641)', 'Logistics', 213880.84, '2023-02-24', '2028-09-01', 66, 0.0585, 7228.56, 406642.80, 'Debt', '640-641', false, 243),
    (v_tab_id, 'TriState Capital', '05-2985-004-000-00', '25 Trailers (53619-53643)', 'Logistics', 1021770.53, '2023-04-10', '2030-04-15', 84, 0.0565, 22505.99, 1557225.00, 'Debt', '53619-53643', false, 244),

    -- Atlantic Union Eq Finance
    (v_tab_id, 'Atlantic Union Eq Finance', '05-2987-000-000-00', '7 T680 Sleepers (678, 684-689)', 'Logistics', 756820.19, '2023-08-15', '2029-02-15', 66, 0.0637, 22585.90, 1254764.00, 'Debt', '678, 684-689', false, 250),
    (v_tab_id, 'Atlantic Union Eq Finance', '05-2987-001-000-00', '3 T680 Sleepers (690-692)', 'Logistics', 340018.73, '2023-10-20', '2029-04-20', 66, 0.0659, 9703.53, 535989.00, 'Debt', '690-692', false, 251),
    (v_tab_id, 'Atlantic Union Eq Finance', '05-2987-002-000-00', '25 Trailers (53669-53693)', 'Logistics', 1058610.14, '2024-06-17', '2031-06-17', 66, 0.0659, 19405.62, 1302999.00, 'Debt', '53669-53693', false, 252),

    -- Balboa Capital
    (v_tab_id, 'Balboa Capital', '07-2910-000-000-00', 'Racking for 1211 Rankin', 'WHS', 135934.67, '2024-05-06', '2026-06-06', 36, 0.0968, 10501.84, 328902.00, 'Debt', '', false, 260),

    -- Constellation
    (v_tab_id, 'Constellation', '08-2925-000-000-00', '11th St - Solar Project', 'MH3', 214234.72, '2023-12-01', '2027-03-01', 40, 0.0000, 15302.47, 612098.94, 'Debt', '', false, 270),
    (v_tab_id, 'Constellation', '10-2925-000-000-00', 'Harrison - Solar Project', 'MH5', 161619.13, '2023-12-01', '2027-03-01', 40, 0.0000, 11544.21, 461768.59, 'Debt', '', false, 271),

    -- Commonwealth
    (v_tab_id, 'Commonwealth', '08-2927-000-000-00', '11th St - All Interest Loan', 'MH3', 0, '2025-08-29', '2045-08-29', 240, 0.0900, 31200.00, 4160000.00, 'Debt', '', false, 280),
    (v_tab_id, 'Commonwealth', '10-2927-000-000-00', '11th St - All Interest Loan', 'MH5', 0, '2025-08-29', '2045-08-29', 240, 0.0900, 66300.00, 8840000.00, 'Debt', '', false, 281),

    -- Win Win Loan
    (v_tab_id, 'Win Win Loan', '10-2926-000-000-00', 'Landmark & 11th - All Interest', 'MH5', 0, '2025-08-01', NULL, NULL, 0.1000, 25000.00, 2500000.00, 'Debt', '', false, 290),
    (v_tab_id, 'Win Win Loan', '10-2926-001-000-00', 'Race St - Paid off 1/2026', 'MH5', 0, '2025-08-01', NULL, NULL, 0.1000, 15000.00, 1500000.00, 'Debt', 'Paid off 1/2026', false, 291),

    -- Midland Bank
    (v_tab_id, 'Midland Bank', '', 'Race St Mortgage', '', 0, '2026-01-06', NULL, NULL, 0.0000, 0, 1500000.00, 'Debt', '', false, 300),

    -- First American
    (v_tab_id, 'First American', '10-2920-000-000-00', 'Harrison Remodel Construction Loan', '', -252668.79, '2022-03-25', '2025-04-01', 36, 0.0665, 28262.04, 1075653.56, 'Lease', '', false, 310);

  END IF;
END $$;
