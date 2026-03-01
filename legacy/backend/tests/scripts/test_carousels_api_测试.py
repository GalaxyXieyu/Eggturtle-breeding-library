# Auto-generated test module for carousels_api_测试
import os
from atf.core.log_manager import log
from atf.core.globals import Globals
from atf.core.variable_resolver import VariableResolver
from atf.core.request_handler import RequestHandler
from atf.core.assert_handler import AssertHandler
import allure
import yaml

@allure.epic('default')
@allure.feature('Carousels API')
class TestCarouselsApi测试:
    @classmethod
    def setup_class(cls):
        log.info('========== 开始执行测试用例：test_carousels_api_测试 (测试轮播图相关接口) ==========')
        cls.test_case_data = cls.load_test_case_data()
        cls.steps_dict = {step['id']: step for step in cls.test_case_data['steps']}
        cls.session_vars = {}
        cls.global_vars = Globals.get_data()
        cls.testcase_host = 'http://localhost:8000'
        cls.VR = VariableResolver(global_vars=cls.global_vars, session_vars=cls.session_vars)
        log.info('Setup completed for TestCarouselsApi测试')

    @staticmethod
    def load_test_case_data():
        yaml_path = os.path.join(os.path.dirname(__file__), '..', 'cases', 'carousels.yaml')
        with open(yaml_path, 'r', encoding='utf-8') as file:
            test_case_data = yaml.safe_load(file)['testcase']
        return test_case_data

    @allure.story('轮播图管理')
    def test_carousels_api_测试(self):
        log.info('Starting test_carousels_api_测试')
        # Step: get_carousels_step
        log.info(f'开始执行 step: get_carousels_step')
        get_carousels_step = self.steps_dict.get('get_carousels_step')
        step_host = self.testcase_host
        response = RequestHandler.send_request(
            method=get_carousels_step['method'],
            url=step_host + self.VR.process_data(get_carousels_step['path']),
            headers=self.VR.process_data(get_carousels_step.get('headers')),
            data=self.VR.process_data(get_carousels_step.get('data')),
            params=self.VR.process_data(get_carousels_step.get('params')),
            files=self.VR.process_data(get_carousels_step.get('files'))
        )
        log.info(f'get_carousels_step 请求结果为：{response}')
        self.session_vars['get_carousels_step'] = response
        db_config = None
        AssertHandler().handle_assertion(
            asserts=self.VR.process_data(get_carousels_step['assert']),
            response=response,
            db_config=db_config
        )


        log.info(f"Test case test_carousels_api_测试 completed.")
